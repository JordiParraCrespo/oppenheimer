import { type DynamicModule, Global, Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ErrorReporter } from './error-reporter.service';
import { errorReportingEnabled } from './init-error-reporting';
import { NoopErrorReporter } from './noop-error-reporter.service';
import { SentryErrorReporter } from './sentry-error-reporter.service';

/**
 * Provides `ErrorReporter` to the whole app: Sentry when `initErrorReporting`
 * started it before the app was built, a no-op otherwise. With Sentry on, it
 * also brings in Sentry's own module, which names each request's trace after
 * its route.
 */
@Global()
@Module({})
export class ErrorReportingModule {
  static forRoot(): DynamicModule {
    const enabled = errorReportingEnabled();
    return {
      module: ErrorReportingModule,
      imports: enabled ? [SentryModule.forRoot()] : [],
      providers: [
        { provide: ErrorReporter, useClass: enabled ? SentryErrorReporter : NoopErrorReporter },
      ],
      exports: [ErrorReporter],
    };
  }
}
