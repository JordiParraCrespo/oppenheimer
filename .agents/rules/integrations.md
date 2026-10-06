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

Write these down in the adapter's doc comment, or in the module's product note
when it has one. A reviewer should not have to look them up.

1. **What is counted, and against what.** Per App, per installation, per
   person, per project, per key. Those are the adapter's **buckets**.
2. **The windows.** Requests per hour or minute, the concurrency cap, and any
   secondary or abuse limit.
3. **How it says "stop".** The statuses (`429`, but GitHub and Google both
   also send `403`), the headers, and what the body says when no header does.
4. **What one screen or job costs.** Count the calls one page view or one job
   makes, multiply by what it fans out over, and compare that with the budget.
   If the multiplication gets close, the design changes (a cache, a webhook, a
   mirror, a smaller page) before the adapter is written.

## One exchange per system, in the API

Every call to the system goes through **one `UpstreamLimiter`**
(`@oppenheimer/backend-core`, `src/upstream/`), built once in the adapter that
owns the system's HTTP. `exchange(buckets, send, readRefusal)` does every step,
in order, so no call site can skip one:

1. it waits for a slot under the in-flight cap, or refuses at once when too
   many calls are waiting, instead of hanging the request;
2. inside the slot, it refuses without calling when any of the call's buckets
   is paused (shared through Redis, so every replica stops together);
3. it sends;
4. it reads the answer: the headers (`readRateLimit`), and for a refusal the
   body, through the adapter's `readRefusal`, which only says whether the body
   names a rate or quota refusal and which bucket it covers;
5. on a refusal for rate, it pauses that bucket (never shortening a pause
   another replica holds) and throws the system's own rate-limit code, a `429`
   with `Retry-After`; on a success that spent the last call, it pauses the
   bucket and returns.

The adapter maps everything else as before. The worked examples are
`github/infrastructure/github-http.adapter.ts` (the one client both GitHub
adapters call) and `calendar/infrastructure/google-calendar.gateway.ts`.

**Buckets are what the provider counts, and the caller passes them.** An
installation token is counted against the installation, whatever token string
was minted for it, so its bucket is `installation:<id>` and not a hash of the
token. A person's token is counted against the person: `user:<githubUserId>`.
Google counts a person and the project, so a call carries both, and a refusal
pauses whichever one Google named. A credential never becomes a key: where
only the secret identifies the bucket, use a digest of it.

**A rate limit is its own error code.** Give the module a catalog entry
(`GITHUB_015`, `CALENDAR_010`) with a row in `apps/docs/docs/errors.md`, a
message in every locale, and an `@ApiProblemResponse` with status 429 on every
route that can reach the system. Never let it fold into the call site's
mapping of `403`: that is how a rate limit reads as "installation suspended"
and tells the person to reinstall something that works.

## Outside the API

- **A package with no workspace dependencies** (`backend-llm`,
  `backend-email`) cannot use the limiter. It still reports a rate limit as
  its own error type or code, carrying `resetAt`, and does not call the
  provider again before then. Its README says what it does.
- **A background job** (BullMQ) does not retry a rate limit on its own
  schedule. When the limit covers the whole provider, the worker holds the
  queue with `queue.rateLimit(ms)` and throws `Worker.RateLimitError()`, which
  needs a `limiter` on the `@Processor`. The job goes back to waiting without
  spending an attempt. The email worker is the example. When the limit covers
  one job, move that job to delayed until the reset.
- **Go** (`apps/runner`) has no shared limiter yet. A runner adapter that
  calls a third party follows the same five steps.

## Spend less before you limit more

Cache reads with `CacheService.getOrSet` (single-flight per key), take webhooks
over polling, reuse a credential for its lifetime (one minted token per hour,
not per call), and use conditional requests where the provider does not count
a `304` (GitHub does not).

## Tests

At the adapter's own boundary, against a `fetch` double:

- a refusal for rate becomes the integration's rate-limit code, including a
  `403` the call site would otherwise map to something else;
- a paused bucket never reaches the network, and neither does a call that was
  already queued when the pause began;
- a successful answer with no calls left pauses the next call;
- calls that share a budget share a bucket.
