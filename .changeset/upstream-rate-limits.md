---
"@oppenheimer/api": minor
"@oppenheimer/backend-core": minor
"@oppenheimer/translations": patch
---

Integrations honour the rate limits of the systems they call. `@oppenheimer/backend-core` gains `readRateLimit`, `UpstreamPause`, `ConcurrencyLimit` and `upstreamRateLimited`, and `AllExceptionsFilter` sends `Retry-After` for an error that carries `retryAfterSeconds`. GitHub's rate limit now answers `GITHUB_015` (429) instead of reading as a suspended installation or an unreachable repository; GitHub is not asked again for that budget until it resets, on any replica, and at most eight GitHub calls are in flight per process. Google Calendar's quota answers `CALENDAR_010` (429) the same way. `.agents/rules/integrations.md` is the rule for every integration after these.
