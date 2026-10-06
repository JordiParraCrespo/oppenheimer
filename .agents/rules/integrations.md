---
paths:
  - "apps/api/src/**/infrastructure/**/*"
  - "packages/backend/**/*"
  - "apps/runner/internal/**/adapters/**/*"
  - "packages/go/**/*"
---

# External integrations and their rate limits

Every system we integrate meters us: GitHub, Google, an LLM provider, an email
API, the next one. **An integration is not done until it respects that
system's rate limit.** A limit we ignore does not stay an error message: the
screen breaks for everyone on the same installation or project, retries make
the refusals last longer, and a provider that sees us keep calling through its
limit escalates. GitHub's secondary limits get longer, and its docs say an
integration that keeps hitting them can be banned.

This rule covers any code that calls a system we do not run, whether through
`fetch`, an SDK or a CLI.

## Before writing the adapter: know the budget

Write these down in the module's product note, or in the adapter's doc
comment when there is no note. A reviewer should not have to look them up.

1. **What is counted, and against what.** Per App, per installation, per user
   token, per project, per IP. That decides the *bucket* a pause covers.
2. **The windows.** Requests per hour or minute, the concurrency cap, and any
   secondary or abuse limit (GitHub: 100 concurrent and points per minute;
   Google: per user per minute and per project per day).
3. **How it says "stop".** The status codes (`429`, but GitHub and Google
   both also send `403`), the headers, and what the body says when no header
   does.
4. **What one screen or job costs.** Count the calls one page view or one job
   makes, multiply by the people or repositories it fans out over, and compare
   that with the budget. If the multiplication gets close, the design changes
   (a cache, a webhook, a mirror, a smaller page) before the adapter is
   written.

## The mechanics every adapter has

The building blocks live in `@oppenheimer/backend-core` (`src/upstream/`).
`apps/api/src/github/infrastructure/github-rate-limit.adapter.ts` is the
reference implementation, and the Google Calendar gateway is the minimal one.

- **One file talks to the system, and every call goes through one
  `request()`.** A second adapter for the same system shares the first one's
  limiter. GitHub's App adapter and pull-requests adapter both inject the same
  `GithubRateLimit`.
- **Read the signals on every answer, successful ones included.**
  `readRateLimit(response)` reads `Retry-After`, `X-RateLimit-*`,
  `RateLimit-*` and the IETF structured `RateLimit` field. Body-only tells,
  such as GitHub's "secondary rate limit" sentence or Google's
  `rateLimitExceeded` reason, are checked in the adapter, because only the
  adapter knows the provider's body shape.
- **A rate limit is its own error code, a `429`.** A package that throws its
  own errors (`backend-llm`, `backend-email`) instead gives them their own
  type or `code`, carrying `resetAt`. In the API, build it with
  `upstreamRateLimited(Errors.X_RATE_LIMITED, { system, resetAt })`.
  `AllExceptionsFilter` then sends `Retry-After`, and the problem document
  carries `retryAfterSeconds`. Never let it fold into the call site's mapping
  of `403`: that is how a rate limit reads as "installation suspended" and
  tells the person to reinstall something that works.
- **Pause the bucket, and do not call into a known pause.** `UpstreamPause`
  holds "not until" per bucket, shared through `CacheService` so every replica
  stops together. Check it before each call. Pause on a refusal, and also on a
  success that reports `remaining: 0`, so the next call is answered locally
  instead of refused remotely.
- **Bound concurrency in the adapter, not in the callers.** A
  `ConcurrencyLimit` around the network call holds no matter how many
  `Promise.all`s fan out above it.
- **No silent retries on the request path.** A user-facing read fails fast
  with the `429` and the reset time. A background job (BullMQ) does not retry
  on its own schedule. When the limit covers the whole provider, the worker
  holds the queue with `queue.rateLimit(ms)` and throws
  `Worker.RateLimitError()`, which needs a `limiter` on the `@Processor`. The
  email worker is the example. When the limit covers one job, it is moved to
  delayed until the reset. Never `sleep` inside a request.
- **Spend less before you limit more.** Cache reads with
  `CacheService.getOrSet` (single-flight per key), take webhooks over polling,
  reuse credentials for their lifetime (one minted token per hour, not per
  call), and use conditional requests where the provider does not count a
  `304` (GitHub does not).

## Tests

At the adapter's own boundary, against a `fetch` double:

- a refusal for rate becomes the integration's rate-limit code, including a
  `403` the call site would otherwise map to something else;
- a paused bucket never reaches the network;
- a successful answer with no calls left pauses the next call.

## Docs

- A row for the rate-limit code in `apps/docs/docs/errors.md`.
- A row in the inventory below.

## Inventory

| System          | Where                                                   | Buckets                                         | Status |
| --------------- | ------------------------------------------------------- | ----------------------------------------------- | ------ |
| GitHub REST     | `apps/api/src/github/infrastructure/`                   | `app`, `installation:<id>`, `oauth`, `token:<hash>` | Pause and in-flight cap (8 per process), `GITHUB_015` |
| Google Calendar | `apps/api/src/calendar/infrastructure/google-calendar.gateway.ts` | `grant:<hash>`                                  | Pause per grant, `CALENDAR_010` |
| LLM providers   | `packages/backend/llm/src/rate-limit.ts`                | the provider (one per `LlmService`)             | A `429` is `LlmError` `rate_limited` with `resetAt`, and the provider is paused until its `Retry-After`. The pause is per process, because this package depends on nothing in the workspace and every caller has a fallback. No concurrency cap: the only caller, session naming, makes one call per session. Add a cap before any caller fans out |
| Email (Resend)  | `packages/backend/email/src/resend-email.service.ts`, `apps/api/src/queue/infrastructure/email.processor.ts` | the team (the queue)                            | Paced at 2 sends a second by the worker's BullMQ `limiter`. A refusal for rate or quota is `EmailRateLimitedError`, and the worker holds the whole queue until the reset (`queue.rateLimit`) without spending the job's attempt |
| S3 storage      | `packages/backend/storage/src/s3-storage.service.ts`    | the bucket                                      | The AWS SDK's own retry and backoff |
| Runner releases | `apps/runner/internal/updates/adapters/release/`        | the release host                                | Our own host. One manifest read per update check |

When you add an integration, add its row. When you close a gap, update its
row.
