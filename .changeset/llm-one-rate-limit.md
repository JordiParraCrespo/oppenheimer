---
"@oppenheimer/backend-llm": minor
"@oppenheimer/backend-agents": minor
"@oppenheimer/api": patch
---

One rate-limit type for both model stacks.

- `@oppenheimer/backend-llm`: `LlmRateLimitError`, the `rate_limited`
  `LlmError` with `resetAt: Date | null`. `LlmError.resetAt` is gone (read it
  from the subclass), and `LlmError.provider`, `LlmService.provider` and
  `LlmCompletion.provider` are plain strings so a bot provider fits.
- `@oppenheimer/backend-agents`: `BotEngine.complete` throws
  `LlmRateLimitError` where it threw `BotRateLimitError`, which is removed.
  `engineLlm(engine, binding)` puts a bot engine's completion behind
  `LlmService`.
- `@oppenheimer/api`: voice's polish runs on one `LlmService` whichever stack
  answers (`POLISH_LLM`); the bot-summaries worker delays a job on
  `LlmRateLimitError`. No behaviour changes.
