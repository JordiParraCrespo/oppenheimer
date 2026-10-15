/**
 * Who answers a bot's turn. `glm` is z.ai's Anthropic-compatible endpoint;
 * `chatgpt` is a ChatGPT subscription, through the backend the Codex CLI uses.
 */
export type BotProvider = 'anthropic' | 'glm' | 'openai' | 'chatgpt';

/** How hard the model thinks. Each engine maps it to what its SDK takes. */
export type BotEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** One tool the model may call during a turn, described by JSON Schema. */
export interface BotEngineTool {
  /** snake_case; the name the model sees and every event carries. */
  name: string;
  description: string;
  /** JSON Schema of an object: the tool's input. */
  inputSchema: Record<string, unknown>;
  /** A throw is reported to the model as an error result; it never ends the turn. */
  run(
    input: unknown,
    context: { signal: AbortSignal },
  ): Promise<{ content: string; isError?: boolean }>;
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
  tools: BotEngineTool[];
  /**
   * Whether the engine offers its own tools (the Claude engine's web search
   * and to-do list) beside `tools`. Default true; a completion turns them off.
   */
  engineTools?: boolean;
  /** Model round trips before the turn ends with `max_steps`. Default 25. */
  maxSteps?: number;
  signal: AbortSignal;
  /** A directory the engine may write in for this turn; the caller creates and deletes it. */
  scratchDir: string;
}

export type BotEngineEvent =
  | { type: 'text.delta'; text: string }
  | { type: 'text.done'; text: string }
  | { type: 'tool.started'; callId: string; name: string; input: unknown }
  | { type: 'tool.finished'; callId: string; name: string; output: string; isError: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | {
      type: 'done';
      reason: 'completed' | 'cancelled' | 'max_steps' | 'failed';
      error?: string;
      /**
       * Set on a `failed` end the provider refused for rate or quota (a
       * `429`, or the SDK naming a rate limit): when it said it may be
       * called again, or null when it did not say.
       */
      rateLimit?: { resetAt: Date | null };
    };

/**
 * What `complete` throws when the provider refused for rate or quota. A
 * caller does not call it again before `resetAt` (null: the provider gave no
 * time, so the caller picks a wait of its own).
 */
export class BotRateLimitError extends Error {
  override readonly name = 'BotRateLimitError';

  constructor(
    message: string,
    readonly resetAt: Date | null,
  ) {
    super(message);
  }
}

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
   * with the turn's reason when it does not complete, as a
   * `BotRateLimitError` when the provider refused for rate or quota.
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
        if (event.rateLimit) throw new BotRateLimitError(reason, event.rateLimit.resetAt);
        throw new Error(reason);
      }
    }
    return texts.join('\n\n').trim();
  }
}

export const DEFAULT_MAX_STEPS = 25;
