import { type OnApplicationShutdown } from '@nestjs/common';
import { RequestContextService } from '@oppenheimer/backend-ddd';
import * as Sentry from '@sentry/nestjs';
import { type ErrorReportContext, ErrorReporter } from './error-reporter.service';

/** The mark the SDK sets on an error it captured, and skips a second capture of. */
const SDK_CAPTURED_MARK = '__sentry_captured__';

/**
 * Forgets that the SDK saw `error` already. An explicit report is the app's
 * decision; an earlier automatic capture must not swallow it. The one that
 * did: Sentry's capture of a job's last attempt (dropped in `beforeSend`,
 * `isJobAttemptEvent`) marked the error, and the job's grouped report of it
 * as failed for good never left.
 */
function releaseFromEarlierCapture(error: unknown): void {
  if (typeof error !== 'object' || error === null) return;
  try {
    delete (error as Record<string, unknown>)[SDK_CAPTURED_MARK];
  } catch {
    // A frozen error keeps its mark; the report is then the SDK's to skip.
  }
}

/** How long shutdown waits for the last reports to leave. */
const SHUTDOWN_FLUSH_MS = 2_000;

/**
 * Sends reports to Sentry, on a scope of their own so one report's tags never
 * reach the next. Every report carries the request's correlation id when
 * there is one, which is what ties it to the API's logs and to the id a 5xx
 * hands the client.
 */
export class SentryErrorReporter extends ErrorReporter implements OnApplicationShutdown {
  readonly enabled = true;

  capture(error: unknown, context: ErrorReportContext = {}): string | undefined {
    return Sentry.withScope((scope) => {
      scope.setLevel(context.level ?? 'error');
      const correlationId = RequestContextService.getCorrelationId();
      if (correlationId) scope.setTag('correlation_id', correlationId);
      if (context.workspaceId) scope.setTag('workspace_id', context.workspaceId);
      if (context.userId) scope.setUser({ id: context.userId });
      for (const [key, value] of Object.entries(context.tags ?? {})) {
        if (value !== null && value !== undefined) scope.setTag(key, value);
      }
      if (context.extra) scope.setExtras(context.extra);
      if (context.fingerprint) scope.setFingerprint([...context.fingerprint]);
      releaseFromEarlierCapture(error);
      return Sentry.captureException(error);
    });
  }

  flush(timeoutMs = SHUTDOWN_FLUSH_MS): Promise<boolean> {
    return Sentry.flush(timeoutMs);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }
}
