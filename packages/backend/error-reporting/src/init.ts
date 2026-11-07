/**
 * The entry `instrument.ts` imports before anything else: the SDK's start and
 * nothing that loads Nest. The package root also brings `ErrorReportingModule`
 * and with it `@sentry/nestjs/setup`, which requires `@nestjs/*` before the SDK
 * has patched them, so Nest's request tracing would be lost.
 */
export {
  type ErrorReportingOptions,
  errorReportingEnabled,
  initErrorReporting,
} from './init-error-reporting';
