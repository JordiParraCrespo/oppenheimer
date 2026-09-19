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
  namerProvider: z.enum(['none', 'anthropic']).default('none'),
  namerModel: z.string().min(1).optional(),
  anthropicApiKey: z.string().min(1).optional(),
});

export const sessionsConfig = registerAs('sessions', () =>
  parseEnv('sessions', schema, {
    namerProvider: 'SESSION_NAMER_PROVIDER',
    namerModel: 'SESSION_NAMER_MODEL',
    anthropicApiKey: 'ANTHROPIC_API_KEY',
  }),
);
