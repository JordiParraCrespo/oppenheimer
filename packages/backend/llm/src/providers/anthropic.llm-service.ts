import { postJson } from '../http';
import { LlmError } from '../llm.errors';
import { LlmService } from '../llm.service';
import type { LlmCompletion, LlmCompletionRequest, LlmConfig } from '../llm.types';
import { asRecord, DEFAULT_MAX_TOKENS, usageFrom } from './openai-compatible.llm-service';

export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
/** The version header the Messages API requires. It is a date, not a model. */
const API_VERSION = '2023-06-01';

/**
 * The Claude API, over its own Messages shape: `system` at the top level,
 * `max_tokens` required, and the answer as a list of content blocks.
 */
export class AnthropicLlmService extends LlmService {
  readonly provider = 'anthropic' as const;

  constructor(private readonly config: LlmConfig) {
    super();
  }

  get defaultModel(): string | undefined {
    return this.config.model;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new LlmError('not_configured', this.provider, 'anthropic has no API key');
    const model = request.model ?? this.config.model;
    if (!model) {
      throw new LlmError(
        'not_configured',
        this.provider,
        'No model was named, and none is configured',
      );
    }

    const baseUrl = (this.config.baseUrl ?? ANTHROPIC_BASE_URL).replace(/\/+$/, '');
    const body = await postJson(
      this.provider,
      `${baseUrl}/messages`,
      { 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
      {
        model,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(request.system ? { system: request.system } : {}),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        messages: request.messages,
      },
      { timeoutMs: request.timeoutMs ?? this.config.timeoutMs, signal: request.signal },
    );

    const record = asRecord(body);
    const content = record?.content;
    if (!Array.isArray(content)) {
      throw new LlmError('invalid_response', this.provider, 'anthropic answered without content');
    }
    // Text blocks only: a thinking block is the model's working, not its answer.
    const text = content
      .map((block) => {
        const typed = asRecord(block);
        return typed?.type === 'text' && typeof typed.text === 'string' ? typed.text : '';
      })
      .join('');
    return {
      text,
      model: typeof record?.model === 'string' ? record.model : model,
      provider: this.provider,
      finishReason: typeof record?.stop_reason === 'string' ? record.stop_reason : null,
      usage: usageFrom(asRecord(record?.usage), 'input_tokens', 'output_tokens'),
    };
  }
}
