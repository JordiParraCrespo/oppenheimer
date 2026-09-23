import { LlmError } from '../llm.errors';
import { LlmService } from '../llm.service';
import type { LlmCompletion } from '../llm.types';

/**
 * The default: no provider. A supported configuration rather than a missing
 * one — a deployment that would rather send nothing to anybody's inference API
 * simply configures none, and every caller already has a fallback.
 */
export class NoopLlmService extends LlmService {
  readonly provider = 'none' as const;
  readonly defaultModel = undefined;

  isConfigured(): boolean {
    return false;
  }

  async complete(): Promise<LlmCompletion> {
    throw new LlmError('not_configured', this.provider, 'No LLM provider is configured');
  }
}
