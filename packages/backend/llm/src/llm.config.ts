import type { LlmConfig } from './llm.types';

/**
 * Whether this configuration can make a call: the hosted providers need a key
 * (their base URL is built in), a self-hosted OpenAI-compatible server needs a
 * base URL (and no key). A pure read — no client is built to answer it, and
 * every provider's `isConfigured()` is this same function.
 */
export function llmIsConfigured(config: LlmConfig | undefined): boolean {
  switch (config?.provider) {
    case 'openrouter':
    case 'together':
    case 'anthropic':
      return Boolean(config.apiKey);
    case 'openai-compatible':
      return Boolean(config.baseUrl);
    default:
      return false;
  }
}
