# @oppenheimer/backend-error-reporting

## 0.2.0

### Minor Changes

- 3b73d6f: The API reports errors to Sentry when `SENTRY_DSN` is set.

  - `@oppenheimer/backend-error-reporting` (new): the `ErrorReporter` port,
    its Sentry driver and a no-op, `initErrorReporting` (run before Nest so
    HTTP, Express, Postgres, ioredis and BullMQ are traced) and
    `ErrorReportingModule`. Every event is scrubbed: no body, cookie, token or
    secret-named parameter, and the user reduced to an id.
  - `@oppenheimer/backend-core`: `AllExceptionsFilter` reports every 5xx, an
    unforeseen one as an error and a curated one as a warning grouped by its
    code, with the route, the user and the workspace.
  - `@oppenheimer/api`: a BullMQ job out of retries is reported, whichever
    processor ran it; a bot turn that threw outside the catalog, or that the
    engine failed without a kind, is reported with its bot, provider and model.
    `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` and
    `SENTRY_TRACES_SAMPLE_RATE` are new; the dev deployment sets the release to
    its commit. The unused `@sentry/nestjs` dependency moves into the package.

### Patch Changes

- fe891c1: Sentry no longer reports each attempt of a queued job as its own unhandled
  issue. Sentry's NestJS SDK wraps every BullMQ `@Processor` and captured every
  throw from it: each attempt BullMQ retries, and each `DelayedError` or
  `RateLimitError` a worker throws to wait (OPPENHEIMER-API-5: four events from
  one bot summary job retrying through a provider overload). Those captures are
  dropped in `beforeSend`.

  A job that fails for good is still reported once, grouped by queue and job.
  That report is now made with a fresh error carrying the job error's name,
  message, stack and cause. Before, the SDK had already captured the worker's
  own error and skipped the report.

- Updated dependencies [85c11ad]
  - @oppenheimer/backend-ddd@0.4.0
