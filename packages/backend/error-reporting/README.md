# @oppenheimer/backend-error-reporting

Where the API reports an error someone should look at, and the Sentry driver
behind it. With no `SENTRY_DSN` it is a no-op, so tests, local development and
`generate:openapi` need nothing.

## What's inside

| Export | Purpose |
| --- | --- |
| `initErrorReporting(options)` | Starts the Sentry SDK. Called first thing, before Nest loads (`apps/api/src/config/instrument.ts`), so HTTP, Express, Postgres, ioredis, BullMQ and Nest are traced. Import it from `@oppenheimer/backend-error-reporting/init`, which loads nothing of Nest; the root also exports it |
| `ErrorReportingModule.forRoot()` | Global module providing `ErrorReporter`: Sentry when started, a no-op otherwise |
| `ErrorReporter` | The port: `capture(error, context)`, `flush(timeoutMs)`, `enabled` |
| `ErrorReportContext` | Level, tags, extras, fingerprint, user id and workspace id of one report |
| `NoopErrorReporter` | The no-op driver, also a base for a test's recording fake |

## What reports what

| Reporter | Reports | Level |
| --- | --- | --- |
| `AllExceptionsFilter` (`backend-core`) | Every 5xx: an unforeseen error, or a curated one (an `AppError`, a framework 503) grouped by its code | error / warning |
| `JobFailureReportingAdapter` (`apps/api/src/queue`) | A BullMQ job out of retries, or failed with `UnrecoverableError`, grouped by queue and job | error |
| `RunBotTurnCommandHandler` (`apps/api/src/bots-chat`) | A bot turn that threw outside the catalog, or that the engine failed without a kind (`other`) | error / warning |
| The SDK itself | Uncaught exceptions and unhandled rejections | fatal / error |

What the SDK captures from a `@Processor`'s `process()` is not sent
(`job-attempt-event.ts`, in `beforeSend`). It wraps every processor and
reports each throw as unhandled: each attempt BullMQ retries, and each
`DelayedError` or `RateLimitError` a worker throws to wait. That made one job
several issues (OPPENHEIMER-API-5). The SDK also skips a second capture of an
object it saw, so the adapter reports a job's last failure with a fresh error
carrying the same name, message, stack and cause
(`JobFailureMapper.toReportedError`).

Every report carries the request's correlation id (`correlation_id`), the same
id a 5xx hands the client and every log line carries.

## Privacy

`scrub-event.ts` runs on every event after every integration has added to it:
no request body, cookie, `Authorization` or API-key header, no query parameter
or extra whose name says it is a secret, and the user reduced to an id. A
report's `extra` is never a prompt, a message or terminal output.

## Usage

```ts
// main.ts, first import
import './config/instrument';

// app.module.ts
imports: [ErrorReportingModule.forRoot(), ...]

// anywhere
constructor(private readonly reporter: ErrorReporter) {}
this.reporter.capture(error, { level: 'warning', tags: { 'queue.name': name } });
```

Configuration is `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` and
`SENTRY_TRACES_SAMPLE_RATE` in the root `.env.example`.
