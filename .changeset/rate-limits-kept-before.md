---
"@oppenheimer/api": minor
"@oppenheimer/backend-core": minor
"@oppenheimer/backend-cache": minor
---

Rate limits are kept before the provider says them, and a bot treats one as
a wait.

- `@oppenheimer/backend-core`: `UpstreamLimiter` takes a `budget` (units a
  window per bucket) and `exchange` a call's `cost`; a call the window cannot
  hold pauses the bucket until the window ends and is refused without being
  sent, shared across replicas through the store's `incrementBy`.
  `GoogleOAuthClient.fetch` takes the call's units. `upstreamRateLimitOf`
  reads `{ system, resetAt }` back off any integration's rate-limit problem.
- `@oppenheimer/backend-cache`: `CacheService.incrementBy`, one atomic add
  that sets the TTL of a new key.
- `@oppenheimer/api`: Gmail spends each call's quota units from 12,000 a
  minute per account. A bot's tool answers a rate limit as who is limiting,
  until when, and not to retry in the turn, without the provider's text; a
  bulk Gmail write the limit stopped partway answers what it changed and what
  it did not reach; and a goal's next turn waits for the limit's end instead
  of running into it again.
