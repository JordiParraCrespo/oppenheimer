---
"@oppenheimer/api": patch
"@oppenheimer/backend-llm": minor
"@oppenheimer/backend-email": minor
---

LLM providers and Resend honour their rate limits. A `429` from an LLM provider is `LlmError` with code `rate_limited` and a `resetAt`, and that provider is not called again until its `Retry-After` has passed. A Resend refusal for rate or a daily or monthly quota throws `EmailRateLimitedError` with `resetAt`. The email worker then holds the whole queue until the reset, without spending the job's attempts, and paces sends at Resend's default of 2 a second.
