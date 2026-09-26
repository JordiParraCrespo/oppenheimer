---
"@oppenheimer/api": patch
"@oppenheimer/translations": patch
"@oppenheimer/api-client": patch
---

A rate-limited request answers `RATE_001` with a `retryAfter` member instead of a codeless 429. `POST /v1/access-grants` returns the grant it created, instead of falling back to another grant in the organization.
