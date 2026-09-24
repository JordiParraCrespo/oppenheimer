/**
 * The providers this package can talk to.
 *
 * `openrouter` and `together` are presets of `openai-compatible`: the same
 * `POST /chat/completions` body, with the base URL (and, for OpenRouter, the
 * attribution headers) filled in. `openai-compatible` is the escape hatch for
 * everything else that speaks that shape — Groq, Fireworks, DeepInfra, vLLM, a
 * local Ollama. `anthropic` is the one with its own wire format.
 */
export type LlmProviderId = 'openrouter' | 'together' | 'anthropic' | 'openai-compatible';

/** The providers a deployment can pick, plus the default: none at all. */
export const LLM_PROVIDERS = [
  'none',
  'openrouter',
  'together',
  'anthropic',
  'openai-compatible',
] as const;
export type LlmProviderSetting = (typeof LLM_PROVIDERS)[number];

/**
 * One turn of the conversation. The system prompt is not a message: providers
 * disagree on where it goes (Anthropic has a top-level `system`, the OpenAI
 * shape has a `system` role), so it is a field of the request instead.
 */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionRequest {
  system?: string;
  messages: LlmMessage[];
  /** Overrides the configured default model for this one call. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /**
   * How long this call may take, end to end, before it is abandoned with an
   * `LlmError` of code `timeout`. Falls back to the configured default.
   */
  timeoutMs?: number;
  /** The caller's own cancellation, combined with the timeout. */
  signal?: AbortSignal;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmCompletion {
  /** The answer's text, as the model wrote it. Nothing is trimmed or cleaned. */
  text: string;
  /** The model that answered, as the provider reported it. */
  model: string;
  provider: LlmProviderId;
  /** The provider's own stop reason (`stop`, `end_turn`, `length`, …), verbatim. */
  finishReason: string | null;
  usage: LlmUsage | null;
}

/**
 * What a deployment configures. Plain data, so a caller can build a client
 * from environment variables, a test fixture or a second set of settings for a
 * different job, without going through Nest.
 */
export interface LlmConfig {
  provider: LlmProviderSetting;
  apiKey?: string;
  /**
   * Where the provider lives, up to and including its `/v1`. Required for
   * `openai-compatible`; an override for the others.
   */
  baseUrl?: string;
  /** The model a request uses when it names none. */
  model?: string;
  /** Default end-to-end timeout for a call. */
  timeoutMs?: number;
  /**
   * How the calling application introduces itself, where the provider asks
   * (OpenRouter's `X-Title` and `HTTP-Referer`). Ignored elsewhere.
   */
  appName?: string;
  appUrl?: string;
}
