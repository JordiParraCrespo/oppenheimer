import type { LlmService } from './llm.service';
import type { LlmConfig } from './llm.types';
import { AnthropicLlmService } from './providers/anthropic.llm-service';
import { NoopLlmService } from './providers/noop.llm-service';
import { OpenAiCompatibleLlmService } from './providers/openai-compatible.llm-service';
import { OpenRouterLlmService } from './providers/openrouter.llm-service';
import { TogetherLlmService } from './providers/together.llm-service';

/**
 * The client for a configuration. Plain function, no Nest, so a module that
 * needs a second provider for a different job builds one here rather than
 * reaching into the global one.
 *
 * A provider switched on without what it needs (a key, a base URL) is still
 * built, and answers `isConfigured() === false`: the caller then falls back the
 * same way it does for `none`, and the startup log is what says why.
 */
export function createLlmService(config: LlmConfig): LlmService {
  switch (config.provider) {
    case 'openrouter':
      return new OpenRouterLlmService(config);
    case 'together':
      return new TogetherLlmService(config);
    case 'anthropic':
      return new AnthropicLlmService(config);
    case 'openai-compatible':
      return new OpenAiCompatibleLlmService(config);
    default:
      return new NoopLlmService();
  }
}
