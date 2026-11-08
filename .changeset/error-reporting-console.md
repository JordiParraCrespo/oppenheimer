---
'@oppenheimer/frontend-core': minor
'@oppenheimer/frontend-web': minor
'@oppenheimer/web': minor
---

The console reports its own bugs to Sentry when `VITE_SENTRY_DSN` is set.

- `@oppenheimer/frontend-core`: `ErrorReportingService` (`app.errors`) over
  an `IErrorReportingClient` port, a no-op by default. It reports a bug of
  ours and drops a request the server answered or the network lost. The
  query client hands it every failure but a 401; `useReportError` and
  `useCaptureError` serve a boundary; sign-in and sign-out set the user, by
  id only.
- `@oppenheimer/frontend-web`: `createWebErrorReportingClient`, Sentry loaded
  in its own chunk only with a DSN, with no Session Replay and every URL,
  cookie and console breadcrumb scrubbed. `RouteError` and `QueryState`
  report what they catch.
- `@oppenheimer/web`: wires it, and uploads hidden source maps at build time
  when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_WEB_PROJECT` are set.
