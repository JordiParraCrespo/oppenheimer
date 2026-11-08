---
sidebar_position: 7
---

# Error reporting

Errors go to [Sentry](https://sentry.io) when a DSN is set, and nowhere when
it is not. The API and the console are two Sentry projects; a report from
either carries the user's id and, for the API, the correlation id a failed
request hands the console, so one support quote finds both sides.

## The API

`@oppenheimer/backend-error-reporting` holds the `ErrorReporter` port, its
Sentry driver and a no-op. `apps/api/src/config/instrument.ts` starts the
SDK before Nest loads, so HTTP, Express, Postgres, ioredis and BullMQ are
traced. What is reported:

| Where | What | Level |
| --- | --- | --- |
| `AllExceptionsFilter` | Every 5xx; a curated one (an `AppError`, a 503) grouped by its code | error / warning |
| Every BullMQ worker | A job out of retries, or failed with `UnrecoverableError` | error |
| Bot turns | A throw outside the catalog, or an engine failure with no kind | error / warning |
| The SDK | Uncaught exceptions and unhandled rejections | fatal |

```bash
SENTRY_DSN=https://…@o0.ingest.sentry.io/1
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=<commit>          # the dev deployment sets it to its commit
SENTRY_TRACES_SAMPLE_RATE=0.1    # 0 sends errors only
```

## The console

The kernel's `ErrorReportingService` (`app.errors`) is the port, and the kit's
`createWebErrorReportingClient` the Sentry adapter, loaded in its own chunk
only when `VITE_SENTRY_DSN` is set. What is reported:

- a render throw a route boundary (`RouteError`) or a `QueryState` catches;
- a query or mutation that failed for a reason of ours: a response that does
  not parse, a `TypeError` in a query function.

Never a request the API answered (the API reports its own 5xx, and a 4xx is a
refusal, not a bug), never a network drop. There is no Session Replay: a
session's terminal is on screen.

```bash
VITE_SENTRY_DSN=https://…@o0.ingest.sentry.io/2
VITE_SENTRY_RELEASE=<commit>
# Source maps, at build time only (never VITE_-prefixed):
SENTRY_AUTH_TOKEN=…
SENTRY_ORG=acme
SENTRY_WEB_PROJECT=oppenheimer-console
```

With the three upload variables set, `vite build` emits hidden source maps,
uploads them under the release and deletes them from `dist/`.

## Privacy

Both sides scrub before sending: no request body, cookie, header or query
string, no console breadcrumb, and the user reduced to an id. A tag or extra
is never a prompt, a message or terminal output.
