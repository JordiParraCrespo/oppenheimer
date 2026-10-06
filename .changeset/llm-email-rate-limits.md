---
"@oppenheimer/api": patch
"@oppenheimer/backend-llm": minor
"@oppenheimer/backend-email": minor
---

`LlmError` gains the `rate_limited` code and `resetAt`; `@oppenheimer/backend-email` gains `EmailRateLimitedError`. The email worker holds its queue until a provider's reset and sends at most 2 emails a second.
