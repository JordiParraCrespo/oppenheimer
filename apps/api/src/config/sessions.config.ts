import type { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { llmIsConfigured } from '@oppenheimer/backend-llm';
import { z } from 'zod';
import { parseEnv } from './env';
import { llmConfigFrom } from './llm.config';

/**
 * How a session is named from its first prompt.
 *
 * The provider is the deployment's LLM (`llm.config.ts`); what is set here is
 * only the naming job's own budget. **Optional, all of it**: a session whose
 * model title does not arrive in time — or a deployment with no model at all —
 * is named from its prompt's own words instead, so nothing here can fail a boot.
 */
const schema = z.object({
  /** A small, fast model for titles. Falls back to `LLM_MODEL`. */
  namerModel: z.string().min(1).optional(),
  /**
   * How long creating a session waits for a model title before it names the
   * session from the prompt's own words. It is on the create path, so it is
   * short: a title is not worth a slow button.
   */
  namerTimeoutMs: z.coerce.number().int().positive().default(2_000),
});

/**
 * Whether a model names sessions on this deployment.
 *
 * One function, called by the capability and the namer adapter — the shape
 * `hostsAreConfigured` already set. It needs a configured provider and a model
 * to ask; without either, sessions are still named, from their prompt.
 */
export function sessionNamerIsConfigured(configService: ConfigService): boolean {
  const llm = llmConfigFrom(configService);
  const model = configService.get<string>('sessions.namerModel') ?? llm.model;
  return llmIsConfigured(llm) && Boolean(model);
}

export const sessionsConfig = registerAs('sessions', () =>
  parseEnv('sessions', schema, {
    namerModel: 'SESSION_NAMER_MODEL',
    namerTimeoutMs: 'SESSION_NAMER_TIMEOUT_MS',
  }),
);
