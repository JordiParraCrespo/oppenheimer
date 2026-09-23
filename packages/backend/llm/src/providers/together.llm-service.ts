import type { LlmConfig } from '../llm.types';
import { OpenAiCompatibleLlmService } from './openai-compatible.llm-service';

export const TOGETHER_BASE_URL = 'https://api.together.xyz/v1';

/**
 * Together AI: hosted open-weights models over the OpenAI shape. A preset of
 * that class — the base URL and a required key.
 */
export class TogetherLlmService extends OpenAiCompatibleLlmService {
  constructor(config: LlmConfig) {
    super(config, 'together');
  }

  protected baseUrl(): string {
    return this.config.baseUrl ?? TOGETHER_BASE_URL;
  }
}
