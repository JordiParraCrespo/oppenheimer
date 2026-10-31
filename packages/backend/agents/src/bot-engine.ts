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
  /** Model round trips before the turn ends with `max_steps`. Default 25. */
  maxSteps?: number;
  signal: AbortSignal;
  /**
   * A directory the engine may write in for this turn; the caller creates and
   * deletes it. Optional: only the Claude engine needs one (Claude Code runs
   * in it), and without one it makes its own for the turn and removes it.
   */
  scratchDir?: string;
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
   * The provider refused a call and the engine waits to try it again (a
   * rate limit, or the provider overloaded or down); `delayMs` when it said
   * how long. Nothing is lost: the turn goes on, or ends `failed`.
   */
  | { type: 'retrying'; reason: 'rate_limit' | 'unavailable'; delayMs: number | null }
  | {
      type: 'usage';
      /** Summed over every call the turn made. */
      inputTokens: number;
      outputTokens: number;
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
  | 'systemPrompt'
  | 'message'
  | 'signal'
  | 'scratchDir'
>;

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
    const texts: string[] = [];
    for await (const event of this.run({
      ...request,
      history: [],
      tools: [],
      engineTools: false,
      maxSteps: 1,
    })) {
      if (event.type === 'text.done') texts.push(event.text);
      if (event.type === 'done' && event.reason !== 'completed') {
        const reason = event.error ?? `The completion ended ${event.reason}.`;
        if (event.rateLimit) {
          throw new LlmRateLimitError(request.provider, reason, event.rateLimit.resetAt);
        }
        throw new Error(reason);
      }
    }
    return texts.join('\n\n').trim();
  }
}

export const DEFAULT_MAX_STEPS = 25;
