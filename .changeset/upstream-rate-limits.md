---
"@oppenheimer/api": minor
"@oppenheimer/backend-core": minor
"@oppenheimer/backend-cache": minor
"@oppenheimer/translations": patch
---

`GITHUB_015` and `CALENDAR_010` are 429s with `Retry-After`, declared on every route that reaches GitHub or Google. `@oppenheimer/backend-core` gains `UpstreamLimiter` and `AppError.retryAfterSeconds`; `@oppenheimer/backend-cache` gains `CacheService.setMax`.
