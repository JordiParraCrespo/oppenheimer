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
  | { type: 'done'; reason: 'completed' | 'cancelled' | 'max_steps' | 'failed'; error?: string };

/**
 * Runs one turn of a bot. The stream never throws once iteration starts:
 * every turn ends with exactly one `done`, and nothing follows it.
 */
export abstract class BotEngine {
  abstract run(request: BotTurnRequest): AsyncIterable<BotEngineEvent>;
}

export const DEFAULT_MAX_STEPS = 25;
