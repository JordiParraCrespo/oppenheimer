# @oppenheimer/backend-agents — Agent Instructions

The engines a bot's turn runs on: one `BotEngine` port over the Claude Agent
SDK (`anthropic`, `glm`) and the OpenAI Agents SDK (`openai`, and `chatgpt`,
the same engine pointed at ChatGPT's Codex backend on a subscription sign-in). Designed in
`product/versions/mvp/25-bots.md` §2.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── bot-engine.ts          # the port: request, tool, event types, abstract BotEngine (run, complete)
├── bot-engine.factory.ts  # createBotEngine: routes by provider
├── fake-bot-engine.ts     # FakeBotEngine, for the API's tests
├── turn.ts                # guardTurn (the stream contract), runTool, key scrubbing
├── claude/                # Claude Agent SDK: options + env, MCP tool server, message translation
├── openai/                # OpenAI Agents SDK: agent and run, stream translation
├── __tests__/             # fake, routing, the live GLM spec
└── index.ts
```

## Conventions

- **The only importer of either SDK.** Nothing an SDK names (a type, a
  zod schema, a message shape) appears in what `index.ts` exports;
  `pnpm check:public-api` holds it, and its `ALLOWED` list gets nothing for
  this package.
- **zod 4 is this package's own.** Both SDKs peer-depend on zod ^4 while
  the rest of the repo is on zod 3; the package depends on `zod@^4` itself
  and takes no zod value in or out.
- **SDKs load lazily.** Each adapter `import()`s its SDK on its first turn,
  so importing the package (and booting the API) starts nothing. The Claude
  SDK is ESM-only; Node 22 loads it from our CommonJS through
  `require(esm)`.
- **Every engine goes through `guardTurn`.** It is what makes the contract
  hold whatever an SDK does: no throw, one `done` last, abort is
  `cancelled` at once, no key in an error.
- **Keys come in on the request.** Never read a provider variable from
  `process.env`, and never pass the API's environment to the Claude
  subprocess: `claudeEnv` builds it from an allowlist.
- **No model ids in code.** Tests use placeholders; the live spec passes
  its model from the test.
- **No test seam in the adapters.** Their constructors take nothing; the
  adapter specs `vi.mock` the SDK module (`@anthropic-ai/claude-agent-sdk`,
  `@openai/agents`), which also catches the lazy `import()`, and script the
  stream through the mock. `openai-responses.spec.ts` runs the real Agents
  SDK against a local Responses API server and must stay unmocked.
- **Tool output is redacted in `runTool`.** The request's key is replaced
  in every tool result before the model or `tool.finished` sees it, the way
  `guardTurn` does for `done.error`.
- **Model pinning has one owner.** `pinAllModels` sets every variable
  Claude Code picks a model through (`MODEL_VARIABLES`, read from the
  binary the SDK ships); recheck that list when the SDK is upgraded.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-agents build
pnpm --filter @oppenheimer/backend-agents test
```
