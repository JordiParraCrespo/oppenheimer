import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/** The longest any probe may wait on one dependency: past it, the orchestrator's own timeout has fired. */
const MAX_DEPENDENCY_TIMEOUT_MS = 30_000;

const timeoutMs = (fallback: number) =>
  z.coerce.number().int().positive().max(MAX_DEPENDENCY_TIMEOUT_MS).default(fallback);

/**
 * The probes and the metrics scrape.
 *
 * The timeouts are **defaulted**: how long `/ready` waits on each dependency
 * before calling it unavailable. Each is enforced by the probe itself, not left
 * to the driver — a Redis `PING` has no deadline of its own.
 *
 * `METRICS_TOKEN` is an **optional capability**: unset, `GET /api/v1/metrics`
 * answers 404 and nothing is exported; set, Prometheus scrapes it with HTTP
 * Basic auth (any username, this as the password). It must be long enough
 * not to be guessed, and a short one fails the boot rather than exporting
 * behind a weak secret.
 */
const schema = z.object({
  databaseTimeoutMs: timeoutMs(2_000),
  redisTimeoutMs: timeoutMs(1_000),
  /** How often the backlog gauges (queues, outbox) are re-read while metrics are on. */
  metricsSampleIntervalMs: z.coerce.number().int().min(1_000).max(300_000).default(15_000),
  metricsToken: z.string().min(32, 'must be at least 32 characters').optional(),
});

export type HealthConfig = z.infer<typeof schema>;

export const healthConfig = registerAs('health', () =>
  parseEnv('health', schema, {
    databaseTimeoutMs: 'HEALTH_DATABASE_TIMEOUT_MS',
    redisTimeoutMs: 'HEALTH_REDIS_TIMEOUT_MS',
    metricsSampleIntervalMs: 'METRICS_SAMPLE_INTERVAL_MS',
    metricsToken: 'METRICS_TOKEN',
  }),
);
