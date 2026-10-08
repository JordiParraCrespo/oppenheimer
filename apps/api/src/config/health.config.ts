import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * The probes and the metrics scrape.
 *
 * `METRICS_TOKEN` is an **optional capability**: unset, `GET /api/v1/metrics`
 * answers 404 and nothing is exported; set, Prometheus scrapes it with HTTP
 * Basic auth (any username, this as the password). It must be long enough
 * not to be guessed, and a short one fails the boot rather than exporting
 * behind a weak secret.
 */
const schema = z.object({
  metricsToken: z.string().min(32, 'must be at least 32 characters').optional(),
});

export type HealthConfig = z.infer<typeof schema>;

export const healthConfig = registerAs('health', () =>
  parseEnv('health', schema, {
    metricsToken: 'METRICS_TOKEN',
  }),
);
