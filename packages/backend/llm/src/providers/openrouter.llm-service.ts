import type { LlmConfig } from '../llm.types';
import { OpenAiCompatibleLlmService } from './openai-compatible.llm-service';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter: one key for hundreds of models, the open-weights ones included
 * (`meta-llama/…`, `qwen/…`, `mistralai/…`, `deepseek/…`), routed to whichever
 * host serves them. That is what makes it the first provider: switching model
 * is a string, not an account.
 *
 * It speaks the OpenAI shape, so this is a preset of that class: the base URL,
 * a required key, and the two optional headers OpenRouter uses to attribute
 * traffic to an app.
 */
export class OpenRouterLlmService extends OpenAiCompatibleLlmService {
  constructor(config: LlmConfig) {
    super(config, 'openrouter');
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  protected baseUrl(): string {
    return this.config.baseUrl ?? OPENROUTER_BASE_URL;
  }

  protected extraHeaders(): Record<string, string> {
    return {
      ...(this.config.appName ? { 'X-Title': this.config.appName } : {}),
      ...(this.config.appUrl ? { 'HTTP-Referer': this.config.appUrl } : {}),
    };
  }
}
