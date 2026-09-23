---
"@oppenheimer/backend-llm": minor
"@oppenheimer/api": minor
---

`@oppenheimer/backend-llm`: one `complete()` client over several LLM providers;
the API binds it from `LLM_*`.

Sessions are named from their first prompt: a model with a short deadline,
otherwise the prompt's own words. `SESSION_NAMER_PROVIDER`,
`SESSION_NAMER_BASE_URL`, `SESSION_NAMER_API_KEY` and `ANTHROPIC_API_KEY` are gone.
