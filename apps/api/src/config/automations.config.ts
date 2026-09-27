import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * The platform level of the automation limits
 * (`product/versions/mvp/16-automations-architecture.md` §Configuration):
 * the ceilings no workspace or automation setting may exceed. What a workspace
 * gets when it sets nothing is the domain's `DEFAULT_PLATFORM_LIMITS`; these
 * only ever tighten or loosen the roof over it.
 *
 * **Optional, all of it**, with the note's numbers as defaults: a deployment
 * that sets nothing runs with them, and nothing here can fail a boot.
 */
const schema = z.object({
  maxRunsPerAutomationHour: z.coerce.number().int().positive().default(60),
  maxRunsPerWorkspaceHour: z.coerce.number().int().positive().default(500),
  headlessRunsPerHost: z.coerce.number().int().positive().default(20),
  staleTtlSeconds: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 60 * 60),
  maxRunSeconds: z.coerce
    .number()
    .int()
    .positive()
    .default(6 * 60 * 60),
  /** How many due triggers one scheduler tick claims. */
  schedulerBatch: z.coerce.number().int().positive().default(200),
});

export type AutomationsConfig = z.infer<typeof schema>;

export const automationsConfig = registerAs('automations', () =>
  parseEnv('automations', schema, {
    maxRunsPerAutomationHour: 'AUTOMATIONS_MAX_RUNS_PER_AUTOMATION_HOUR',
    maxRunsPerWorkspaceHour: 'AUTOMATIONS_MAX_RUNS_PER_WORKSPACE_HOUR',
    headlessRunsPerHost: 'AUTOMATIONS_MAX_RUNS_PER_HOST',
    staleTtlSeconds: 'AUTOMATIONS_MAX_STALE_TTL_SECONDS',
    maxRunSeconds: 'AUTOMATIONS_MAX_RUN_SECONDS',
    schedulerBatch: 'AUTOMATIONS_SCHEDULER_BATCH',
  }),
);
