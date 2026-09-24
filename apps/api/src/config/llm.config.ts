import type { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { LLM_PROVIDERS, type LlmConfig } from '@oppenheimer/backend-llm';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * The deployment's LLM provider, for the short, best-effort calls the product
 * makes — a session's title today (`sessions.config.ts`), other one-shot queries
 * later. `@oppenheimer/backend-llm` is the client; this is only where its
 * settings come from.
 *
 * **Optional, all of it.** `none` is the default, and every caller has a
 * fallback that does not need a model, so nothing here can fail a boot. A
 * provider switched on without its key (or, for `openai-compatible`, its base
 * URL) is not configured rather than half-configured, and the startup log
 * says so.
 *
 * `model` has no default that names a model family: a model id is a moving
 * target and a deployment picks its own.
 */
const schema = z.object({
  provider: z.enum(LLM_PROVIDERS).default('none'),
  apiKey: z.string().min(1).optional(),
  /** Required for `openai-compatible`; an override for the hosted presets. */
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).optional(),
  timeoutMs: z.coerce.number().int().positive().default(10_000),
});

export const llmConfig = registerAs('llm', () =>
  parseEnv('llm', schema, {
    provider: 'LLM_PROVIDER',
    apiKey: 'LLM_API_KEY',
    baseUrl: 'LLM_BASE_URL',
    model: 'LLM_MODEL',
    timeoutMs: 'LLM_TIMEOUT_MS',
  }),
);

/**
 * The client's configuration, read key by key so one function serves the
 * module's factory, the capability and the session namer alike.
 */
export function llmConfigFrom(configService: ConfigService): LlmConfig {
  return {
    provider: configService.get<LlmConfig['provider']>('llm.provider') ?? 'none',
    apiKey: configService.get<string>('llm.apiKey'),
    baseUrl: configService.get<string>('llm.baseUrl'),
    model: configService.get<string>('llm.model'),
    timeoutMs: configService.get<number>('llm.timeoutMs'),
    // OpenRouter attributes traffic to an app by these; other providers ignore them.
    appName: 'Oppenheimer',
    appUrl: configService.get<string>('app.frontendUrl'),
  };
}
