import { postJson } from '../http';
import { LlmError } from '../llm.errors';
import { LlmService } from '../llm.service';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmConfig,
  LlmProviderId,
  LlmUsage,
} from '../llm.types';

/** Without a budget a provider picks its own, which can be thousands of tokens. */
export const DEFAULT_MAX_TOKENS = 1024;

/**
 * Any server that speaks OpenAI's `POST {baseUrl}/chat/completions`.
 *
 * **One class, most of the field.** Groq, Together, Fireworks, DeepInfra,
 * OpenRouter, a vLLM deployment and a local Ollama all accept the same body, so
 * a new one is a base URL rather than a class. `OpenRouterLlmService` and
 * `TogetherLlmService` are that: this class with the URL filled in.
 *
 * The key is optional here and required by the presets: a model served on your
 * own machine wants none, and sending `Authorization: Bearer ` with nothing
 * after it is refused by some servers, so no key means no header.
 */
export class OpenAiCompatibleLlmService extends LlmService {
  readonly provider: LlmProviderId;

  constructor(
    protected readonly config: LlmConfig,
    provider: LlmProviderId = 'openai-compatible',
  ) {
    super();
    this.provider = provider;
  }

  get defaultModel(): string | undefined {
    return this.config.model;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl());
  }

  /** Where the server lives. The presets override this with their own default. */
  protected baseUrl(): string | undefined {
    return this.config.baseUrl;
  }

  /** Extra headers a preset adds (OpenRouter's attribution). */
  protected extraHeaders(): Record<string, string> {
    return {};
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const baseUrl = this.baseUrl();
    if (!baseUrl) {
      throw new LlmError('not_configured', this.provider, `${this.provider} has no base URL`);
    }
    const model = request.model ?? this.config.model;
    if (!model) {
      throw new LlmError(
        'not_configured',
        this.provider,
        'No model was named, and none is configured',
      );
    }

    const messages = [
      ...(request.system ? [{ role: 'system', content: request.system }] : []),
      ...request.messages,
    ];
    const body = await postJson(
      this.provider,
      `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
      {
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        ...this.extraHeaders(),
      },
      {
        model,
        messages,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      },
      { timeoutMs: request.timeoutMs ?? this.config.timeoutMs, signal: request.signal },
    );
    return this.parse(body, model);
  }

  /**
   * The first choice's text, narrowed once so nothing downstream casts. A body
   * that is not this shape is an `invalid_response`, not an exception from deep
   * inside a property access.
   */
  private parse(body: unknown, requestedModel: string): LlmCompletion {
    const record = asRecord(body);
    const choices = record?.choices;
    const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined;
    const content = asRecord(first?.message)?.content;
    if (typeof content !== 'string') {
      throw new LlmError(
        'invalid_response',
        this.provider,
        `${this.provider} answered without a choice to read`,
      );
    }
    return {
      text: content,
      model: typeof record?.model === 'string' ? record.model : requestedModel,
      provider: this.provider,
      finishReason: typeof first?.finish_reason === 'string' ? first.finish_reason : null,
      usage: usageFrom(asRecord(record?.usage), 'prompt_tokens', 'completion_tokens'),
    };
  }
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function usageFrom(
  usage: Record<string, unknown> | undefined,
  inputKey: string,
  outputKey: string,
): LlmUsage | null {
  const input = usage?.[inputKey];
  const output = usage?.[outputKey];
  if (typeof input !== 'number' || typeof output !== 'number') return null;
  return { inputTokens: input, outputTokens: output };
}
