import { z } from 'zod';
import { parseEnv } from './env';

const schema = z.object({
  dsn: z.string().url().optional(),
  environment: z.string().optional(),
  release: z.string().optional(),
  tracesSampleRate: z.coerce.number().min(0).max(1).default(0),
  nodeEnv: z.string().default('development'),
});

/** Where the API reports errors (`@oppenheimer/backend-error-reporting`); no DSN, no reports. */
export interface ErrorReportingConfig {
  dsn?: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
}

/**
 * Read before Nest exists (`instrument.ts` runs it first thing), so it is a
 * plain function rather than a `registerAs` section: the SDK must start
 * before the modules it instruments load.
 */
export function errorReportingConfig(): ErrorReportingConfig {
  const parsed = parseEnv('errorReporting', schema, {
    dsn: 'SENTRY_DSN',
    environment: 'SENTRY_ENVIRONMENT',
    release: 'SENTRY_RELEASE',
    tracesSampleRate: 'SENTRY_TRACES_SAMPLE_RATE',
    nodeEnv: 'NODE_ENV',
  });
  return {
    dsn: parsed.dsn,
    environment: parsed.environment ?? parsed.nodeEnv,
    release: parsed.release,
    tracesSampleRate: parsed.tracesSampleRate,
  };
}
