import * as Sentry from '@sentry/nestjs';
import { scrubEvent } from './scrub-event';

/** How the process reports errors; `dsn` unset leaves reporting off. */
export interface ErrorReportingOptions {
  /** The Sentry project's DSN. Unset or blank turns reporting off. */
  readonly dsn?: string;
  /** `production`, `staging`, `development`… Sentry filters and alerts on it. */
  readonly environment: string;
  /** The deployed version, so an issue names the release it started in. */
  readonly release?: string;
  /** The share of requests traced, 0 to 1; 0 sends errors only. */
  readonly tracesSampleRate?: number;
  /** The service name, set as the `service` tag on every event. */
  readonly service: string;
}

/**
 * Starts the Sentry SDK. Call it once, before anything else is imported:
 * Sentry instruments HTTP, Express, Postgres, ioredis and BullMQ by patching
 * them as they load, and a module loaded first is not traced.
 *
 * Returns whether reporting is on. `ErrorReportingModule` reads the same
 * answer (`errorReportingEnabled`) to pick its driver.
 */
export function initErrorReporting(options: ErrorReportingOptions): boolean {
  const dsn = options.dsn?.trim();
  if (!dsn || Sentry.isInitialized()) return Sentry.isInitialized();
  Sentry.init({
    dsn,
    environment: options.environment,
    release: options.release || undefined,
    tracesSampleRate: options.tracesSampleRate ?? 0,
    sendDefaultPii: false,
    initialScope: { tags: { service: options.service } },
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  });
  return true;
}

/** Whether `initErrorReporting` started the SDK in this process. */
export function errorReportingEnabled(): boolean {
  return Sentry.isInitialized();
}
