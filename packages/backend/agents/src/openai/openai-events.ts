import type { BotEngineEvent } from '../bot-engine';
import { describeError, failed } from '../turn';

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
 * in the SDK's event; the adapter records it as it runs the tool, and
 * passes it in.
 */
export class OpenAiEventTranslator {
  private inputTokens = 0;
  private outputTokens = 0;
  private sawUsage = false;

  constructor(private readonly toolFailed: (callId: string) => boolean) {}

  translate(event: OpenAiStreamEvent): BotEngineEvent[] {
    if (event.type === 'raw_model_stream_event') {
      const { data } = event;
      if (data.type === 'output_text_delta' && data.delta)
        return [{ type: 'text.delta', text: data.delta }];
      if (data.type === 'response_done' && data.response?.usage) {
        this.sawUsage = true;
        this.inputTokens += data.response.usage.inputTokens ?? 0;
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
      case 'tool_output':
        if (raw.type !== 'function_call_result' || !raw.callId || !raw.name) return [];
        return [
          {
            type: 'tool.finished',
            callId: raw.callId,
            name: raw.name,
            output: outputText(event.item.output),
            isError: this.toolFailed(raw.callId),
          },
        ];
      default:
        return [];
    }
  }

  /** `usage` when a response reported it, then the one `done` for how the run ended. */
  finish(error: unknown): BotEngineEvent[] {
    const events: BotEngineEvent[] = [];
    if (this.sawUsage) {
      events.push({
        type: 'usage',
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
      });
    }
    if (error === undefined || error === null) {
      events.push({ type: 'done', reason: 'completed' });
    } else if (error instanceof Error && error.name === 'MaxTurnsExceededError') {
      events.push({ type: 'done', reason: 'max_steps' });
    } else {
      events.push(failed(describeError(error)));
    }
    return events;
  }
}
