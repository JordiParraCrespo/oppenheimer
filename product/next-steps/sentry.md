# Sentry: errors reported, and issues that start work

Two loops, built as a stack of pull requests from 2026-11-02. Version not set.

1. **Every error reaches Sentry** with enough to act on: the API, its
   workers, bots, the console, and later the runner.
2. **A Sentry issue wakes Oppenheimer**: an automation (or a bot's routine)
   starts on a new issue, a regression or an alert, investigates it in a
   session, opens a fix, and Sentry resolves the issue on the release that
   ships it.

## Loop 1: reporting

| Surface | What is reported | Slice |
| --- | --- | --- |
| API | Every 5xx (`AllExceptionsFilter`): unforeseen as an error, curated (an `AppError`, a 503) as a warning grouped by code; uncaught exceptions and rejections | 1 |
| Workers | A BullMQ job out of retries, or `UnrecoverableError`, grouped by queue and job; one listener for every processor | 1 |
| Bots | A turn that threw outside the catalog (error), or that the engine failed without a kind (`other`, warning). A kind (rate limit, quota, refused key, time limit) is the provider's or the person's and is not reported | 1 |
| Console | Route and query error boundaries, unhandled rejections; source maps uploaded at build time; no Session Replay (a session's terminal is on screen) | 2 |
| Runner | Opt-in only, since it runs on the person's machine: panics and link failures, never terminal content or paths | later |

Every report carries the correlation id the API's logs and a 5xx's problem
document already carry, plus the user and workspace ids. Nothing else about
the person: the scrubber drops bodies, cookies, tokens and secret-named
parameters, and reduces the user to an id
(`packages/backend/error-reporting/src/scrub-event.ts`).

Configuration is `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` and
`SENTRY_TRACES_SAMPLE_RATE` (the API) and their `VITE_SENTRY_*` twins (the
console). No DSN, no reports: tests, local development and
`generate:openapi` are untouched.

## Loop 2: Sentry as a trigger source

The automation catalog (`packages/shared/src/automations/catalog.ts`) already
says a new source is rows there plus an adapter in the API. Sentry is the
third external source, after GitHub and Gmail.

- **Connection.** A workspace connects one Sentry organization with an
  internal integration: its token (sealed, like a cloud agent's key) and its
  client secret, which signs every webhook (`Sentry-Hook-Signature`, HMAC
  SHA-256 of the body). The webhook URL is per connection, so a delivery
  names its workspace before its signature is checked.
- **Subject.** A trigger watches a Sentry project, by slug, the way a GitHub
  trigger watches a repository.
- **Events.** `issue.created` (a new issue), `issue.regressed` (a resolved
  issue came back), `issue.escalating`, and `alert.triggered` (an issue alert
  rule fired; Sentry's own rules decide what pages). The filter is the
  environment or the level.
- **What the run gets.** The issue's title, culprit, level, link and short
  id, and the first frames of the stack trace when the token can read the
  latest event. Nothing from the event's request or breadcrumbs.
- **Loop guard.** One run per issue per trigger: the issue id is the
  delivery's dedup key, so an error storm is one run. The automation limits
  (runs per hour per automation and per workspace) still apply.
- **Closing the loop.** The run's pull request says `Fixes <SHORT-ID>`;
  Sentry resolves the issue when a release containing that commit is
  deployed (releases carry the commit since slice 1). A regression fires
  `issue.regressed`, which starts the next run.

## Slices

1. Backend reporting: `@oppenheimer/backend-error-reporting`, the filter,
   the job listener, bot turns, the env and the deployment's release.
2. Console reporting: `@sentry/react` in `apps/web`, the boundaries, source
   maps.
3. The Sentry source: connection, webhook, adapter, catalog rows, the
   console's connect form.
4. Bots read Sentry: a tool to fetch an issue and its latest event, so a
   routine can look deeper than the webhook.

## Decision log

- 2026-11-02: written; slices 1 to 3 built as stacked pull requests. The
  runner stays out until its opt-in is designed.
- 2026-11-02: slice 2 built: the console reports render throws its route
  and `QueryState` boundaries catch, and query or mutation failures that are
  not a request the server answered; source maps upload at build time.
- 2026-11-02: slice 3 built. The connection is one per workspace and is
  managed in Settings → Sentry; the automation editor offers the four Sentry
  events once it exists. The read endpoint answers `{ configured, connection }`
  rather than a 404, as cloud agents do. Bot routines can carry a Sentry
  trigger through the API; the bot's routine tool does not offer one yet.
