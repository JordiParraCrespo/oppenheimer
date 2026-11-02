import type { BotEngineEvent, BotPlanLimits } from '../bot-engine';
import { describeError, failed, failureOf, resetFromHeaders, type ToolCallData } from '../turn';

/**
 * The part of the OpenAI Agents SDK's `RunStreamEvent` this package reads,
 * as plain structure: the translation is tested against it without the SDK.
 */
export type OpenAiStreamEvent =
  | {
      type: 'raw_model_stream_event';
      data: {
        type: string;
        delta?: string;
        response?: { usage?: { inputTokens?: number; outputTokens?: number } };
      };
    }
  | {
      type: 'run_item_stream_event';
      name: string;
      item: { type: string; rawItem?: unknown; output?: unknown };
    }
  | { type: 'agent_updated_stream_event' };

type RawItem = {
  type?: string;
  callId?: string;
  name?: string;
  arguments?: string;
  content?: unknown;
};

function parseArguments(text: string | undefined): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((part: { type?: string; text?: string; refusal?: string }) =>
      part.type === 'output_text'
        ? (part.text ?? '')
        : part.type === 'refusal'
          ? (part.refusal ?? '')
          : '',
    )
    .join('');
}

function outputText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && (output as { type?: string }).type === 'text') {
    return String((output as { text?: unknown }).text ?? '');
  }
  return output === undefined ? '' : JSON.stringify(output);
}

/**
 * Turns the OpenAI Agents SDK's stream events into the engine's events, and
 * the run's end into `usage` and `done`. Whether a tool call failed is not
 * in the SDK's event, nor what the call made; the adapter records both as
 * it runs the tool, and passes them in. The context is what the last
 * response was sent (each call sends the whole conversation, so the last is
 * the most); the SDK does not say the model's window, so it goes without.
 */
export class OpenAiEventTranslator {
  private inputTokens = 0;
  private outputTokens = 0;
  private sawUsage = false;
  private lastInput = 0;

  constructor(
    private readonly toolFailed: (callId: string) => boolean,
    private readonly made: ToolCallData,
  ) {}

  translate(event: OpenAiStreamEvent): BotEngineEvent[] {
    if (event.type === 'raw_model_stream_event') {
      const { data } = event;
      if (data.type === 'output_text_delta' && data.delta)
        return [{ type: 'text.delta', text: data.delta }];
      if (data.type === 'response_done' && data.response?.usage) {
        this.sawUsage = true;
        this.lastInput = data.response.usage.inputTokens ?? 0;
        this.inputTokens += this.lastInput;
        this.outputTokens += data.response.usage.outputTokens ?? 0;
      }
      return [];
    }
    if (event.type !== 'run_item_stream_event') return [];

    const raw = (event.item.rawItem ?? {}) as RawItem;
    switch (event.name) {
      case 'message_output_created': {
        const text = messageText(raw.content);
        return text ? [{ type: 'text.done', text }] : [];
      }
      case 'tool_called':
        if (raw.type !== 'function_call' || !raw.callId || !raw.name) return [];
        return [
          {
            type: 'tool.started',
            callId: raw.callId,
            name: raw.name,
            input: parseArguments(raw.arguments),
          },
        ];
      case 'tool_output': {
        if (raw.type !== 'function_call_result' || !raw.callId || !raw.name) return [];
        return this.made.finished({
          callId: raw.callId,
          name: raw.name,
          output: outputText(event.item.output),
          isError: this.toolFailed(raw.callId),
        });
      }
      default:
        return [];
    }
  }

  /**
   * `usage` when a response reported it, then the one `done` for how the run
   * ended. `limits` are the subscription's windows as its last answer said
   * them, for an endpoint that reports them (ChatGPT's).
   */
  finish(error: unknown, limits: BotPlanLimits | null = null): BotEngineEvent[] {
    const events: BotEngineEvent[] = [];
    if (this.sawUsage) {
      events.push({
        type: 'usage',
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        ...(this.lastInput > 0 ? { context: { tokens: this.lastInput, window: null } } : {}),
        ...(limits ? { limits } : {}),
      });
    }
    if (error === undefined || error === null) {
      events.push({ type: 'done', reason: 'completed' });
    } else if (error instanceof Error && error.name === 'MaxTurnsExceededError') {
      events.push({ type: 'done', reason: 'max_steps' });
    } else {
      const failure = failureOf(error);
      // A spent quota is a 429 too, but waiting for Retry-After does not bring it back.
      const rateLimit = failure === 'rate_limit' ? rateLimitOf(error) : null;
      events.push(failed(describeError(error), failure, rateLimit ?? undefined));
    }
    return events;
  }
}

/**
 * A refusal for rate or quota: the OpenAI client's error for a `429`, with
 * when the provider may be called again from its `Retry-After` headers.
 */
function rateLimitOf(error: unknown): { resetAt: Date | null } | null {
  const refused = error as { status?: unknown; headers?: unknown } | null;
  if (!refused || typeof refused !== 'object' || refused.status !== 429) return null;
  const headers = refused.headers;
  const read = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name);
    if (headers && typeof headers === 'object') {
      const value = (headers as Record<string, unknown>)[name];
      return typeof value === 'string' ? value : null;
    }
    return null;
  };
  return { resetAt: resetFromHeaders(read) };
}
