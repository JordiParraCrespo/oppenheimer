---
'@oppenheimer/backend-error-reporting': minor
'@oppenheimer/backend-core': minor
'@oppenheimer/api': minor
---

The API reports errors to Sentry when `SENTRY_DSN` is set.

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
