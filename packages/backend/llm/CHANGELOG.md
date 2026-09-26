# @oppenheimer/backend-llm

## 0.2.0

### Minor Changes

- 7ff8b30: `@oppenheimer/backend-llm`: one `complete()` client over several LLM providers;
  the API binds it from `LLM_*`.

  Sessions are named from their first prompt: a model with a short deadline,
  otherwise the prompt's own words. `SESSION_NAMER_PROVIDER`,
  `SESSION_NAMER_BASE_URL`, `SESSION_NAMER_API_KEY` and `ANTHROPIC_API_KEY` are gone.
