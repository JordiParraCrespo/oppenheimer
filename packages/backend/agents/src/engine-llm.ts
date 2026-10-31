import {
  type LlmCompletion,
  type LlmCompletionRequest,
  LlmError,
  LlmService,
} from '@oppenheimer/backend-llm';
import type { BotEffort, BotEngine, BotProvider } from './bot-engine';

/**
 * The provider, credential and model a bot engine answers an `LlmService`
 * call on. There is no temperature and no token cap here, and a request may
 * not bring one: a bot engine runs its provider's agent SDK, which takes an
 * effort, not sampling settings.
 */
export interface EngineLlmBinding {
  provider: BotProvider;
  /** The key, or for `chatgpt` the sign-in's access token, as `BotTurnRequest.apiKey`. */
  apiKey: string;
  accountId?: string;
  baseUrl?: string;
  /** The model a request that names none runs on. */
  model: string;
  effort?: BotEffort | null;
}

/**
 * A bot engine's completion behind the `LlmService` contract, so a caller
 * that may run on a workspace's own model credential (a ChatGPT sign-in) or
 * on the deployment's LLM (`LLM_*`) holds one interface for both.
 *
 * What it takes of an `LlmCompletionRequest`: `system`, one user message (no
 * history), `model`, `timeoutMs` and `signal`. `temperature` and `maxTokens`
 * are not settings a bot engine has, so a request that sets either is
 * refused with a `TypeError` before any call rather than run without them:
 * a caller that may land here sends them only to the deployment's LLM.
 *
 * It rejects as `BotEngine.complete` does: `LlmRateLimitError` when the
 * provider refused for rate, an error with the turn's reason otherwise, and
 * `not_configured` before any call when the binding has no key.
 */
export function engineLlm(engine: BotEngine, binding: EngineLlmBinding): LlmService {
  return new EngineLlmService(engine, binding);
}

class EngineLlmService extends LlmService {
  readonly provider: string;
  readonly defaultModel: string;

  constructor(
    private readonly engine: BotEngine,
    private readonly binding: EngineLlmBinding,
  ) {
    super();
    this.provider = binding.provider;
    this.defaultModel = binding.model;
  }

  isConfigured(): boolean {
    return Boolean(this.binding.apiKey);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    if (request.temperature !== undefined || request.maxTokens !== undefined) {
      throw new TypeError('A bot engine takes no temperature or maxTokens');
    }
    const [message, ...rest] = request.messages;
    if (message?.role !== 'user' || rest.length > 0) {
      throw new TypeError('A bot engine completes one user message, with no history');
    }
    if (!this.isConfigured()) {
      throw new LlmError('not_configured', this.provider, `${this.provider} has no credential`);
    }
    const model = request.model ?? this.defaultModel;
    const signals = [request.signal, timeout(request.timeoutMs)].filter(
      (signal): signal is AbortSignal => signal !== undefined,
    );
    const text = await this.engine.complete({
      provider: this.binding.provider,
      apiKey: this.binding.apiKey,
      accountId: this.binding.accountId,
      baseUrl: this.binding.baseUrl,
      model,
      effort: this.binding.effort,
      systemPrompt: request.system ?? '',
      message: message.content,
      signal: signals.length > 0 ? AbortSignal.any(signals) : new AbortController().signal,
    });
    return { text, model, provider: this.provider, finishReason: null, usage: null };
  }
}

function timeout(ms: number | undefined): AbortSignal | undefined {
  return ms && ms > 0 ? AbortSignal.timeout(ms) : undefined;
}
