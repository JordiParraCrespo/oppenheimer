import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BotEngineEvent, BotTurnContext } from '../bot-engine';
import { failed, type ToolCallData } from '../turn';
import { botToolName } from './claude-tool-server';

type ContentBlock = { type: string; [key: string]: unknown };

function blocksOf(content: unknown): ContentBlock[] {
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

/** What one model call was sent, cached or not, off its usage; none when it says nothing. */
function sentTokens(usage: unknown): number | null {
  if (typeof usage !== 'object' || usage === null) return null;
  const counts = usage as Record<string, unknown>;
  const count = (key: string) => (typeof counts[key] === 'number' ? (counts[key] as number) : 0);
  const sent =
    count('input_tokens') + count('cache_read_input_tokens') + count('cache_creation_input_tokens');
  return sent > 0 ? sent : null;
}

/** A tool result's content as text: a string as it is, text blocks joined. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  return blocksOf(content)
    .map((block) =>
      block.type === 'text' && typeof block.text === 'string' ? block.text : `[${block.type}]`,
    )
    .join('\n');
}

/**
 * Turns the Claude Agent SDK's messages into the engine's events, one
 * message at a time, and the run's end into `usage` and `done`.
 *
 * - Text streams from the main thread only; a subagent's own text stays
 *   inside its tool call, as the chat shows it.
 * - Tool calls are reported from the main thread and from subagents, so the
 *   chat's activity line counts what a subagent did with our tools.
 * - A synthetic assistant message carrying an `error` (a refused key, an
 *   unknown model) is the failure's reason, never the bot's text.
 * - The context is what the main thread's last answer was sent, read off
 *   that message's own usage (the run's usage sums every call, which is
 *   not what the context held), against the window the run's `modelUsage`
 *   gives the model it ran on.
 * - A failure the provider refused for rate or quota (the SDK's
 *   `rate_limit` error, a `429` status, a rejected rate-limit event) ends
 *   with `rateLimit`, and with when it may be called again when the SDK
 *   said: the reset of a rejected limit, else the wait Claude Code was
 *   given for its own retry of the refused call.
 */
export class ClaudeEventTranslator {
  private readonly toolNames = new Map<string, string>();
  private result: SDKResultMessage | undefined;
  private lastError: string | undefined;
  private rateLimited = false;
  private resetAt: Date | null = null;
  /** What the main thread's last answer was sent; none before the first. */
  private contextTokens: number | null = null;

  /** `made`: what our tools' calls made, recorded by the tool server as they ran. */
  constructor(private readonly made: ToolCallData) {}

  translate(message: SDKMessage): BotEngineEvent[] {
    switch (message.type) {
      case 'stream_event':
        return this.fromStreamEvent(
          message.event as { type: string; delta?: { type: string; text?: string } },
          message.parent_tool_use_id,
        );
      case 'assistant':
        if (message.parent_tool_use_id === null && message.error === undefined) {
          this.contextTokens = sentTokens(message.message.usage) ?? this.contextTokens;
        }
        return this.fromAssistant(
          message.message.content,
          message.parent_tool_use_id,
          message.error,
        );
      case 'user':
        return this.fromUser(message.message.content);
      case 'result':
        this.result = message;
        return [];
      case 'system':
        this.fromSystem(
          message as {
            subtype?: string;
            error?: unknown;
            error_status?: unknown;
            retry_delay_ms?: unknown;
          },
        );
        return [];
      case 'rate_limit_event':
        this.fromRateLimit(message.rate_limit_info);
        return [];
      default:
        return [];
    }
  }

  /** `usage` when the run reported it, then the one `done`. */
  finish(diagnostics?: string): BotEngineEvent[] {
    const result = this.result;
    if (!result) {
      return [
        this.failed(this.lastError ?? diagnostics ?? 'Claude Code stopped without a result.'),
      ];
    }
    if (result.subtype === 'success' && result.api_error_status === 429) this.rateLimited = true;
    const { usage } = result;
    const context = this.contextOf(result);
    const events: BotEngineEvent[] = [
      {
        type: 'usage',
        inputTokens:
          (usage.input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens ?? 0,
        ...(context ? { context } : {}),
      },
    ];
    if (result.subtype === 'success') {
      events.push(
        result.is_error
          ? this.failed(
              this.lastError ?? (result.result || diagnostics || 'The model call failed.'),
            )
          : { type: 'done', reason: 'completed' },
      );
    } else if (result.subtype === 'error_max_turns') {
      events.push({ type: 'done', reason: 'max_steps' });
    } else {
      events.push(this.failed(result.errors.join('; ') || this.lastError || result.subtype));
    }
    return events;
  }

  /**
   * The context at the last answer, against the window of the model that
   * did most of the run's reading (a subagent on a smaller model reads
   * less), when the run reported one.
   */
  private contextOf(result: SDKResultMessage): BotTurnContext | null {
    if (this.contextTokens === null) return null;
    let window: number | null = null;
    let read = -1;
    for (const model of Object.values(result.modelUsage ?? {})) {
      const modelRead =
        model.inputTokens + model.cacheReadInputTokens + model.cacheCreationInputTokens;
      if (modelRead > read && model.contextWindow > 0) {
        read = modelRead;
        window = model.contextWindow;
      }
    }
    return { tokens: this.contextTokens, window };
  }

  /** A failed end, marked as a rate limit when the provider refused for one. */
  private failed(error: string): BotEngineEvent {
    return this.rateLimited ? failed(error, { resetAt: this.resetAt }) : failed(error);
  }

  /** Claude Code retrying a refused call: a rate limit's says how long it was told to wait. */
  private fromSystem(message: {
    subtype?: string;
    error?: unknown;
    error_status?: unknown;
    retry_delay_ms?: unknown;
  }): void {
    if (message.subtype !== 'api_retry') return;
    if (message.error !== 'rate_limit' && message.error_status !== 429) return;
    this.rateLimited = true;
    if (typeof message.retry_delay_ms === 'number' && message.retry_delay_ms > 0) {
      this.resetAt = new Date(Date.now() + message.retry_delay_ms);
    }
  }

  /** A limit the provider says is exhausted, with when it resets (epoch seconds). */
  private fromRateLimit(info: { status?: string; resetsAt?: number } | undefined): void {
    if (info?.status !== 'rejected') return;
    this.rateLimited = true;
    if (typeof info.resetsAt === 'number' && info.resetsAt > 0) {
      this.resetAt = new Date(info.resetsAt < 1e12 ? info.resetsAt * 1_000 : info.resetsAt);
    }
  }

  private fromStreamEvent(
    event: { type: string; delta?: { type: string; text?: string } },
    parentToolUseId: string | null,
  ): BotEngineEvent[] {
    if (parentToolUseId !== null) return [];
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      event.delta.text
    ) {
      return [{ type: 'text.delta', text: event.delta.text }];
    }
    return [];
  }

  private fromAssistant(
    content: unknown,
    parentToolUseId: string | null,
    error: unknown,
  ): BotEngineEvent[] {
    const blocks = blocksOf(content);
    if (error !== undefined) {
      const text = blocks
        .filter((block) => block.type === 'text')
        .map((block) => String(block.text))
        .join('\n');
      this.lastError = text || String(error);
      if (error === 'rate_limit') this.rateLimited = true;
      return [];
    }
    const events: BotEngineEvent[] = [];
    for (const block of blocks) {
      if (
        block.type === 'text' &&
        parentToolUseId === null &&
        typeof block.text === 'string' &&
        block.text
      ) {
        events.push({ type: 'text.done', text: block.text });
      } else if (
        block.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string'
      ) {
        const name = botToolName(block.name);
        this.toolNames.set(block.id, name);
        events.push({ type: 'tool.started', callId: block.id, name, input: block.input ?? {} });
      }
    }
    return events;
  }

  private fromUser(content: unknown): BotEngineEvent[] {
    const events: BotEngineEvent[] = [];
    for (const block of blocksOf(content)) {
      if (block.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
      const name = this.toolNames.get(block.tool_use_id);
      if (name === undefined) continue;
      this.toolNames.delete(block.tool_use_id);
      const data = this.made.take(block.tool_use_id);
      events.push({
        type: 'tool.finished',
        callId: block.tool_use_id,
        name,
        output: resultText(block.content),
        isError: block.is_error === true,
        ...(data ? { data } : {}),
      });
    }
    return events;
  }
}
