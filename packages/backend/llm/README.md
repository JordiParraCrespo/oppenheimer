# @oppenheimer/backend-llm

One interface for calling an LLM from the NestJS API, whichever provider is
behind it.

## What's inside

- `LlmService` — the abstract contract consumers inject: `complete(request)`
  returns `{ text, model, provider, finishReason, usage }` or throws an
  `LlmError`.
- Providers, all over `fetch` (no vendor SDKs), chosen by `provider` and
  internal to the package:

  | `provider`          | Needs                    |
  | ------------------- | ------------------------ |
  | `openrouter`        | `apiKey`                 |
  | `together`          | `apiKey`                 |
  | `anthropic`         | `apiKey`                 |
  | `openai-compatible` | `baseUrl` (key optional) |
  | `none` (default)    | —                        |

  OpenRouter and Together are presets of the OpenAI-compatible client (the
  base URL filled in, and OpenRouter's `X-Title` / `HTTP-Referer` headers).
  `openai-compatible` covers everything else that serves
  `POST {baseUrl}/chat/completions`: Groq, Fireworks, vLLM, a local Ollama.
- `LlmError` — one error type, with a `code`: `not_configured`, `timeout`,
  `aborted`, `network`, `http` (with `status`) or `invalid_response`.
- `createLlmService(config)` builds a client without Nest; `llmIsConfigured(config)`
  answers whether one could make a call, without building anything.
- `LlmModule.forRoot(config)` / `forRootAsync({ inject, useFactory })` — a
  `@Global` module binding `LlmService` to the configured provider.

## Usage

```ts
// app.module.ts
LlmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    provider: 'openrouter',
    apiKey: config.get('llm.apiKey'),
    model: 'google/gemma-3-12b-it',
  }),
});

// anywhere
constructor(private readonly llm: LlmService) {}

const { text } = await this.llm.complete({
  system: 'Answer in one word.',
  messages: [{ role: 'user', content: 'Is the sky blue?' }],
  maxTokens: 8,
  timeoutMs: 2_000, // end to end, body included
});
```

A request may name its own `model` over the configured default, and pass a
`signal` to cancel. Every failure throws: whether to fall back is the caller's
decision, because only the caller knows what the fallback is.

In `apps/api` the settings come from `LLM_PROVIDER`, `LLM_API_KEY`,
`LLM_BASE_URL`, `LLM_MODEL` and `LLM_TIMEOUT_MS` (`src/config/llm.config.ts`).

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm test    # vitest, against a real local HTTP server
```

## Consumed by

`apps/api` (session naming).
