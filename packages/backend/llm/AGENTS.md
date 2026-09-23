# @oppenheimer/backend-llm — Agent Instructions

One `LlmService` contract over several LLM providers, for the NestJS API.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── llm.service.ts        # abstract LlmService (the port)
├── llm.types.ts          # request, completion, config, provider ids
├── llm.errors.ts         # LlmError and its codes
├── llm.config.ts         # llmIsConfigured: a pure read of the config
├── llm.factory.ts        # createLlmService: the only thing that news a provider
├── llm.module.ts         # @Global LlmModule.forRoot / forRootAsync
├── http.ts               # the one JSON POST with a deadline
├── parse.ts              # shared body-reading helpers, for every wire format
├── providers/            # one class per provider; presets extend openai-compatible
└── index.ts
```

## Conventions

- **Pluggable service pattern**: consumers inject the abstract `LlmService`;
  the module picks the class from `config.provider`. The root export is the
  contract (`LlmService`, `LlmModule`, `createLlmService`, `llmIsConfigured`,
  `LlmError`, the types); provider classes and base URLs stay internal.
- `complete` refuses with `not_configured` on the same predicate
  `isConfigured()` answers, before any network call.
- **Throw, don't swallow.** Every failure is an `LlmError` with a `code`. The
  caller decides the fallback.
- **`fetch`, no vendor SDKs.** A new provider that speaks the OpenAI shape is
  a preset of `OpenAiCompatibleLlmService` (base URL, headers, key rule), not
  a new client. One with its own wire format gets its own class, like
  `AnthropicLlmService`.
- **No model ids in code.** A model is configuration; tests use placeholders.
- Keep `complete` the whole surface until something needs more (streaming,
  tools): every provider then has to answer for it.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-llm build
pnpm --filter @oppenheimer/backend-llm test
```
