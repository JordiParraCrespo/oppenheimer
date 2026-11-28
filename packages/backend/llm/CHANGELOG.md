# @oppenheimer/backend-llm

## 0.3.0

### Minor Changes

- baf4c2c: One rate-limit type for both model stacks.

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

## 0.2.0

### Minor Changes

- 7ff8b30: `@oppenheimer/backend-llm`: one `complete()` client over several LLM providers;
  the API binds it from `LLM_*`.

  Sessions are named from their first prompt: a model with a short deadline,
  otherwise the prompt's own words. `SESSION_NAMER_PROVIDER`,
  `SESSION_NAMER_BASE_URL`, `SESSION_NAMER_API_KEY` and `ANTHROPIC_API_KEY` are gone.

- 2f7fdce: `LlmError` gains the `rate_limited` code and `resetAt`; `@oppenheimer/backend-email` gains `EmailRateLimitedError`. The email worker holds its queue until a provider's reset.
