import { type OnApplicationShutdown } from '@nestjs/common';
import { RequestContextService } from '@oppenheimer/backend-ddd';
import * as Sentry from '@sentry/nestjs';
import { type ErrorReportContext, ErrorReporter } from './error-reporter.service';

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
