# @oppenheimer/backend-error-reporting — Agent Instructions

Error reporting for the NestJS API, with Sentry as the driver.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── error-reporter.service.ts          # abstract ErrorReporter (the port) and its context type
├── sentry-error-reporter.service.ts   # Sentry driver: one scope per report, the correlation id on each
├── noop-error-reporter.service.ts     # no DSN: reports nothing
├── init-error-reporting.ts            # Sentry.init, before Nest; errorReportingEnabled()
├── job-attempt-event.ts               # beforeSend: the SDK's own capture of a queued job's attempt is not sent
├── init.ts                            # the ./init entry: init only, no Nest
├── scrub-event.ts                     # beforeSend: what never leaves the API
├── error-reporting.module.ts          # global module, picks the driver
└── index.ts
```

## Conventions

- **Nothing Sentry in the public API.** Callers speak `ErrorReporter` and
  `ErrorReportContext`; `@sentry/*` types stay inside the drivers
  (`pnpm check:public-api`).
- **Init before Nest.** `initErrorReporting` runs in the app's first import,
  taken from the `./init` entry (`src/init.ts`), which must never import
  `@nestjs/*` or the module;
  `ErrorReportingModule.forRoot()` only reads whether it did. The module never
  starts the SDK itself: by then the libraries it instruments are loaded.
- **Report what someone acts on.** A 4xx, a retried job attempt, a provider's
  rate limit or a refused key are not reports; the person or the next retry
  handles them. Group by cause (`fingerprint`) when one cause throws from many
  places.
- **Never a secret or a conversation.** A new field on an event that can hold
  one is scrubbed in `scrub-event.ts`, with a case in its spec.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-error-reporting build
pnpm --filter @oppenheimer/backend-error-reporting test
```
