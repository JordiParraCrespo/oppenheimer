import { LlmRateLimitError } from '@oppenheimer/backend-llm';

/**
 * Who answers a bot's turn. `glm` is z.ai's Anthropic-compatible endpoint;
 * `chatgpt` is a ChatGPT subscription, through the backend the Codex CLI uses;
 * `xai` is Grok, through xAI's Responses API.
 */
export type BotProvider = 'anthropic' | 'glm' | 'openai' | 'chatgpt' | 'xai';

/** How hard the model thinks. Each engine maps it to what its SDK takes. */
export type BotEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * What a call made, as data beside its words (the session it started): the
 * model never reads it, and `tool.finished` hands it back to the caller.
 */
export type BotToolData = Readonly<Record<string, string>>;

/** What one of our tools answers: the words the model reads, and what it made. */
export interface BotEngineToolResult {
  content: string;
  isError?: boolean;
  data?: BotToolData;
}

/** What one call of a tool runs with. */
export interface BotEngineToolCall {
  signal: AbortSignal;
  /** The id `tool.started` and `tool.finished` carry for this call, when the SDK names it. */
  callId?: string;
}

/** A message the person sent while the turn ran, for the turn to take in. */
export interface BotSteer {
  /** The caller's id for it (the stored message), handed back on `steered`. */
  id: string;
  text: string;
}

/**
 * Where a running turn picks up what the person sent while it worked
 * (Codex's `turn/steer`). The engine asks after each of our tool calls,
 * before the model reads the call's result: what `take` answers is
 * delivered then, riding that result, and the caller hands each one over
 * once. A turn that calls no tool of ours never asks, so what the person
 * sent waits for the turn after it.
 */
export interface BotSteering {
  /** What was sent since the last ask, now the turn's; none is an empty list. A throw delivers nothing. */
  take(): Promise<readonly BotSteer[]>;
}

/** One tool the model may call during a turn, described by JSON Schema. */
export interface BotEngineTool {
  /** snake_case; the name the model sees and every event carries. */
  name: string;
  description: string;
  /** JSON Schema of an object: the tool's input. */
  inputSchema: Record<string, unknown>;
  /** A throw is reported to the model as an error result; it never ends the turn. */
  run(input: unknown, context: BotEngineToolCall): Promise<BotEngineToolResult>;
}

/** An image the turn's message carries, as the person sent it. */
export interface BotTurnImage {
  /** The formats every engine here reads. */
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  /** The bytes, base64-encoded. */
  data: string;
}

export interface BotTurnRequest {
  provider: BotProvider;
  /**
   * Passed per call; the package never reads a key from the environment. For
   * `chatgpt` it is the ChatGPT sign-in's access token, refreshed by the caller.
   */
  apiKey: string;
  /** The ChatGPT account the access token acts for. Required for `chatgpt`, ignored otherwise. */
  accountId?: string;
  /** Overrides the provider's default endpoint. */
  baseUrl?: string;
  model: string;
  /** Ignored by a model or endpoint that takes no effort setting. */
  effort?: BotEffort | null;
  /**
   * A stable id for the conversation the turn continues, the same on every
   * turn of it. A provider whose prompt cache lives per server sends the
   * requests that carry one key to the same server: the Responses API's
   * `prompt_cache_key` (OpenAI, ChatGPT's backend, xAI). Absent, the
   * provider routes each request on its own, and most of them miss. The
   * Claude engine has no use for it: Claude Code marks what to cache itself.
   */
  cacheKey?: string;
  systemPrompt: string;
  /** Earlier turns, oldest first. */
  history: { role: 'user' | 'assistant'; text: string }[];
  /** This turn's user message. */
  message: string;
  /**
   * Images sent with `message`, in the order they were attached; none when
   * absent. The caller sends them only to a provider whose models read them.
   */
  images?: readonly BotTurnImage[];
  tools: BotEngineTool[];
  /**
   * Whether the engine offers its own tools (the Claude engine's web search
   * and to-do list) beside `tools`. Default true; a completion turns them off.
   */
  engineTools?: boolean;
  /**
   * Model round trips before the turn ends with `max_steps`. Absent: no
   * limit, and the turn runs until the model answers without a tool call
   * (`25-bots.md` §2, 2026-11-09). A run with a narrow job (a completion,
   * a subagent) passes one.
   */
  maxSteps?: number;
  /**
   * The model's context window in tokens, when the caller knows it. Mid-turn
   * compaction reads it against `BOT_COMPACTION_WINDOW`, whichever is
   * smaller (`compactionThreshold`).
   */
  contextWindow?: number | null;
  /**
   * Whether the turn compacts mid-turn past `compactionThreshold`. Default
   * true; a completion turns it off, being the call that writes a summary.
   */
  compaction?: boolean;
  signal: AbortSignal;
  /**
   * A directory the engine may write in for this turn; the caller creates and
   * deletes it. Optional: only the Claude engine needs one (Claude Code runs
   * in it), and without one it makes its own for the turn and removes it.
   */
  scratchDir?: string;
  /** Absent: nothing the person sends meanwhile reaches this turn. */
  steering?: BotSteering;
}

/** One of a subscription's usage windows: the share used, 0–100, and when it resets. */
export interface BotPlanWindow {
  usedPercent: number;
  resetsAt: Date | null;
}

/**
 * A subscription's usage windows as the provider reported them on the
 * turn's last answer: the 5-hour one and the weekly one, each absent when it
 * did not say. Only a sign-in to a subscription has them (ChatGPT's); a
 * provider on an API key bills per token instead.
 */
export interface BotPlanLimits {
  fiveHour: BotPlanWindow | null;
  sevenDay: BotPlanWindow | null;
}

/**
 * What the model's context held when it gave the turn's last answer: what
 * that call was sent, cached or not, and the window it is read against when
 * the engine knows it.
 */
export interface BotTurnContext {
  tokens: number;
  window: number | null;
}

export type BotEngineEvent =
  | { type: 'text.delta'; text: string }
  | { type: 'text.done'; text: string }
  | { type: 'tool.started'; callId: string; name: string; input: unknown }
  | {
      type: 'tool.finished';
      callId: string;
      name: string;
      output: string;
      isError: boolean;
      /** What one of our tools said the call made; absent for the engine's own tools. */
      data?: BotToolData;
    }
  /**
   * What the person sent while the turn worked reached the model, with the
   * result of call `callId`: follows that call's `tool.finished`, whose
   * `output` is the tool's own, without them.
   */
  | { type: 'steered'; callId: string; steers: readonly BotSteer[] }
  /**
   * The provider refused a call and the engine waits to try it again (a
   * rate limit, or the provider overloaded or down); `delayMs` when it said
   * how long. Nothing is lost: the turn goes on, or ends `failed`.
   */
  | { type: 'retrying'; reason: 'rate_limit' | 'unavailable'; delayMs: number | null }
  /**
   * The context was folded mid-turn: what the model had read so far was
   * replaced by a summary, so the turn goes on below its window
   * (`compactionThreshold`). The tokens are estimates of what the next
   * call would have been sent, before and after.
   */
  | { type: 'compacted'; tokensBefore: number; tokensAfter: number }
  | {
      type: 'usage';
      /** Summed over every call the turn made, cached or not. */
      inputTokens: number;
      outputTokens: number;
      /**
       * How much of `inputTokens` was read from the provider's prompt cache,
       * and how much was written to it (Anthropic's cache writes; OpenAI's
       * cache has none). Absent when the provider did not say.
       */
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      context?: BotTurnContext;
      limits?: BotPlanLimits;
    }
  | {
      type: 'done';
      reason: 'completed' | 'cancelled' | 'max_steps' | 'failed';
      error?: string;
      /** Set on a `failed` end: what kind of failure it was, so the chat can say whether a retry helps. */
      failure?: BotEngineFailure;
      /**
       * Set on a `failed` end the provider refused for rate or quota (a
       * `429`, or the SDK naming a rate limit): when it said it may be
       * called again, or null when it did not say.
       */
      rateLimit?: { resetAt: Date | null };
    };

/**
 * Why a turn failed, as far as the engine can tell from the provider's
 * answer: a rate limit, a spent quota or credit, a refused key or sign-in,
 * a request the provider refused (its content, the model), the provider
 * down or unreachable, or none of those.
 */
export const BOT_ENGINE_FAILURES = [
  'rate_limit',
  'usage_limit',
  'credential',
  'refused',
  'unavailable',
  'other',
] as const;
export type BotEngineFailure = (typeof BOT_ENGINE_FAILURES)[number];

/**
 * One answer to one message, with no tools and no history: a request for
 * text the caller keeps (a conversation's summary), on the same provider,
 * model and key a turn would use.
 */
export type BotCompletionRequest = Pick<
  BotTurnRequest,
  | 'provider'
  | 'apiKey'
  | 'accountId'
  | 'baseUrl'
  | 'model'
  | 'effort'
  | 'cacheKey'
  | 'systemPrompt'
  | 'message'
  | 'signal'
  | 'scratchDir'
>;

/** What one completion spent: input (cached or not), output, and the cache's share of the input. */
export interface BotCompletionUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** A completion's text, and what it spent when the provider said. */
export interface BotCompletion {
  text: string;
  usage: BotCompletionUsage | null;
}

/** What makes a run a completion: one step, none of our tools and none of the engine's. */
const COMPLETION_MAX_STEPS = 1;

/** A fresh one each call: the request's `tools` is a mutable array. */
function completionShape(): Pick<
  BotTurnRequest,
  'tools' | 'engineTools' | 'maxSteps' | 'compaction'
> {
  return { tools: [], engineTools: false, maxSteps: COMPLETION_MAX_STEPS, compaction: false };
}

/**
 * Whether `request` is one `BotEngine.complete` made, rather than a turn: the
 * one test of it, next to the shape it tests, so a wrapper that tells the two
 * apart (the API's engine metrics) cannot drift from what `complete` sends.
 */
export function isCompletionRequest(request: BotTurnRequest): boolean {
  return (
    request.maxSteps === COMPLETION_MAX_STEPS &&
    request.tools.length === 0 &&
    request.engineTools === false
  );
}

/**
 * Runs one turn of a bot. The stream never throws once iteration starts:
 * every turn ends with exactly one `done`, and nothing follows it.
 */
export abstract class BotEngine {
  abstract run(request: BotTurnRequest): AsyncIterable<BotEngineEvent>;

  /**
   * A completion: one model round trip with no tool at all, ours or the
   * engine's, through `run`, so it holds to the same contract (no key in an
   * error, abort honoured). Resolves to the text the model wrote; rejects
   * with the turn's reason when it does not complete, as an
   * `LlmRateLimitError` (`@oppenheimer/backend-llm`, the type both model
   * stacks raise) when the provider refused for rate or quota.
   */
  async complete(request: BotCompletionRequest): Promise<string> {
    return (await this.completeWithUsage(request)).text;
  }

  /**
   * `complete`, with what the call spent as the provider reported it, so a
   * caller that answers for the spend (a bot's usage) can record it. The
   * usage is null when the provider said nothing.
   */
  async completeWithUsage(request: BotCompletionRequest): Promise<BotCompletion> {
    const texts: string[] = [];
    let usage: BotCompletionUsage | null = null;
    for await (const event of this.run({ ...request, history: [], ...completionShape() })) {
      if (event.type === 'text.done') texts.push(event.text);
      if (event.type === 'usage') {
        usage = {
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          cacheReadTokens: event.cacheReadTokens ?? 0,
          cacheWriteTokens: event.cacheWriteTokens ?? 0,
        };
      }
      if (event.type === 'done' && event.reason !== 'completed') {
        const reason = event.error ?? `The completion ended ${event.reason}.`;
        if (event.rateLimit) {
          throw new LlmRateLimitError(request.provider, reason, event.rateLimit.resetAt);
        }
        throw new Error(reason);
      }
    }
    return { text: texts.join('\n\n').trim(), usage };
  }
}

/**
 * The window a turn compacts against, whatever the model's own: a bot's turn
 * stays small enough to be quick and cheap on every call, and the summary
 * between turns keeps what matters (`25-bots.md` §2, "Compaction",
 * 2026-11-09; from Codex, Grok Bot and OpenClaw, which compact at 90%, 70%
 * and 75% of the model's window).
 */
export const BOT_COMPACTION_WINDOW = 128_000;

/** The share of the window, in percent, past which a turn compacts. */
export const BOT_COMPACTION_PERCENT = 70;

/** What compaction keeps word for word: the newest of what the turn read, about this many tokens. */
export const BOT_COMPACTION_KEEP_TOKENS = 20_000;

/** The tokens past which a turn on a model of `window` compacts. */
export function compactionThreshold(window: number | null | undefined): number {
  const capped = Math.min(
    window && window > 0 ? window : BOT_COMPACTION_WINDOW,
    BOT_COMPACTION_WINDOW,
  );
  return Math.floor((capped * BOT_COMPACTION_PERCENT) / 100);
}
