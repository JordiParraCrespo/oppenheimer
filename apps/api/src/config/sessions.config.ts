import type { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * What this deployment needs in order to name a session from its first prompt.
 *
 * **Optional, all of it.** With no provider a session keeps the slug it was minted
 * with, which reads fine and costs nothing — so this is a capability
 * (`session_namer` in `capabilities.module.ts`) rather than a required setting, and
 * nothing here can fail a boot.
 *
 * `model` carries no default that names a model family. A model id is a moving
 * target and a deployment picks its own; the placeholder in `.env.example` exists so
 * whoever turns the provider on knows what shape the value has, and a provider
 * switched on without one is simply not configured.
 */
const schema = z.object({
  namerProvider: z.enum(['none', 'anthropic', 'openai-compatible']).default('none'),
  namerModel: z.string().min(1).optional(),
  anthropicApiKey: z.string().min(1).optional(),
  /**
   * Where an OpenAI-compatible server lives, up to and including `/v1`. One
   * adapter serves Groq, Together, OpenRouter, vLLM and a local Ollama, so this
   * is the setting that picks between them.
   */
  namerBaseUrl: z.string().url().optional(),
  /**
   * Optional on purpose: a model served on your own machine wants no key, and
   * requiring one would rule out the deployment where the prompt never leaves
   * the building.
   */
  namerApiKey: z.string().min(1).optional(),
});

/**
 * Whether this deployment can actually name a session.
 *
 * One function, called by the capability, by the module's factory and by the
 * adapter's config class — the shape `hostsAreConfigured` already set. A provider
 * switched on without its key or its model is **not configured** rather than
 * half-configured: the no-op namer is bound, every session keeps its slug, and the
 * startup log says so.
 */
export function sessionNamerIsConfigured(configService: ConfigService): boolean {
  const provider = configService.get<string>('sessions.namerProvider');
  // A model id is what every provider needs; what else it needs differs.
  if (!configService.get('sessions.namerModel')) return false;
  if (provider === 'anthropic') return Boolean(configService.get('sessions.anthropicApiKey'));
  // The key is not checked: a local server legitimately has none, and a remote
  // one without a key fails its first call and keeps the slug, which is the same
  // outcome as no namer at all.
  if (provider === 'openai-compatible') return Boolean(configService.get('sessions.namerBaseUrl'));
  return false;
}

export const sessionsConfig = registerAs('sessions', () =>
  parseEnv('sessions', schema, {
    namerProvider: 'SESSION_NAMER_PROVIDER',
    namerModel: 'SESSION_NAMER_MODEL',
    anthropicApiKey: 'ANTHROPIC_API_KEY',
    namerBaseUrl: 'SESSION_NAMER_BASE_URL',
    namerApiKey: 'SESSION_NAMER_API_KEY',
  }),
);
