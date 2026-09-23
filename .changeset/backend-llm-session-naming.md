---
"@oppenheimer/backend-llm": minor
"@oppenheimer/api": minor
---

New package `@oppenheimer/backend-llm`: one `LlmService` contract over
OpenRouter, Together AI, Anthropic and any OpenAI-compatible server, with an
end-to-end timeout and a typed `LlmError`. The API binds it from `LLM_PROVIDER`,
`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` and `LLM_TIMEOUT_MS`.

Session naming now uses it. Creating a session asks the model for a title while
the host is told about the session and waits up to `SESSION_NAMER_TIMEOUT_MS`
(2 s by default); if the model is slow, fails or is not configured, the session
is named from the prompt's own opening words instead, so the response carries a
name either way.

**Breaking config:** `SESSION_NAMER_PROVIDER`, `SESSION_NAMER_BASE_URL`,
`SESSION_NAMER_API_KEY` and `ANTHROPIC_API_KEY` are replaced by the `LLM_*`
variables. `SESSION_NAMER_MODEL` stays, as an optional override of `LLM_MODEL`.
