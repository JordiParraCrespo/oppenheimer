import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Deployment overrides of the automation limits
 * (`product/versions/mvp/16-automations-architecture.md` §Configuration). The numbers
 * live in the domain's `DEFAULT_PLATFORM_LIMITS`: each key here, when set, replaces the
 * platform ceiling of the same name (the roof no workspace or automation setting
 * exceeds), and `diskFloorBytes` the free disk a host must report before it is given a
 * run. All optional with no defaults here, so nothing here can fail a boot.
 */
const positive = z.coerce.number().int().positive().optional();

const schema = z.object({
  maxRunsPerAutomationHour: positive,
  maxRunsPerWorkspaceHour: positive,
  liveRunsPerHost: positive,
  staleTtlSeconds: positive,
  maxRunSeconds: positive,
  diskFloorBytes: z.coerce.number().int().min(0).optional(),
  /** How many due triggers one scheduler tick claims. */
  schedulerBatch: positive,
});

export type AutomationsConfig = z.infer<typeof schema>;

export const automationsConfig = registerAs('automations', () =>
  parseEnv('automations', schema, {
    maxRunsPerAutomationHour: 'AUTOMATIONS_MAX_RUNS_PER_AUTOMATION_HOUR',
    maxRunsPerWorkspaceHour: 'AUTOMATIONS_MAX_RUNS_PER_WORKSPACE_HOUR',
    liveRunsPerHost: 'AUTOMATIONS_MAX_RUNS_PER_HOST',
    staleTtlSeconds: 'AUTOMATIONS_MAX_STALE_TTL_SECONDS',
    maxRunSeconds: 'AUTOMATIONS_MAX_RUN_SECONDS',
    diskFloorBytes: 'AUTOMATIONS_HOST_DISK_FLOOR_BYTES',
    schedulerBatch: 'AUTOMATIONS_SCHEDULER_BATCH',
  }),
);
