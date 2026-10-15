# @oppenheimer/backend-agents

The engines a bot's turn runs on. A bot is a chat agent whose loop runs in a
BullMQ worker inside the API (`product/versions/mvp/25-bots.md` §2); this
package is the only code that imports the two agent SDKs, and it hides both
behind one port.

## Providers

| `provider`  | Engine                                     | Reaches the model at                                                     |
| ----------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `anthropic` | Claude Agent SDK (Claude Code as a library) | Anthropic's API (`ANTHROPIC_API_KEY`), or `baseUrl` when given            |
| `glm`       | Claude Agent SDK                           | z.ai's Anthropic-compatible endpoint, `https://api.z.ai/api/anthropic` (`ANTHROPIC_AUTH_TOKEN`), or `baseUrl` |
| `openai`    | OpenAI Agents SDK, Responses API           | OpenAI's API, or `baseUrl` when given                                    |

No model id is written in the package: the bot's model comes in on every
request. `effort` goes to Claude Code's `effort` option and to OpenAI's
`reasoning.effort`; a model or endpoint that takes none ignores it.

## Usage

```ts
import { createBotEngine, type BotEngineTool } from '@oppenheimer/backend-agents';

const engine = createBotEngine();

for await (const event of engine.run({
  provider: 'glm',
  apiKey,                       // the workspace's key, decrypted for this turn
  model: bot.model,
  effort: bot.effort,
  systemPrompt,                 // soul, instructions, memory
  history,                      // earlier turns, oldest first
  message,                      // this turn's user message
  tools,                        // BotEngineTool[]: JSON Schema in, text out
  signal,                       // Stop aborts it
  scratchDir,                   // created and deleted by the caller
})) {
  // publish to the chat's stream, store the messages
}
```

**Keys are passed per call and never read from the environment.** The
package reads no `ANTHROPIC_*`, `OPENAI_*` or other provider variable, and
it never logs a key; an error or a tool result that echoes one has it
replaced with `[redacted]` before it leaves the engine, and a tool result
before the model reads it.

## The event contract

`run(request)` returns an `AsyncIterable<BotEngineEvent>`:

| Event                                              | Means                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `text.delta { text }`                              | Text as the model writes it (main thread only)                         |
| `text.done { text }`                               | One assistant text block complete                                      |
| `tool.started { callId, name, input }`             | The model called a tool; `name` is ours, without Claude's `mcp__` prefix |
| `tool.finished { callId, name, output, isError }`  | Its result, as the model read it                                       |
| `usage { inputTokens, outputTokens }`              | The turn's totals, once, before `done` (input includes cached tokens)  |
| `done { reason, error? }`                          | `completed`, `cancelled`, `max_steps` or `failed` with a reason        |

- The stream never throws once iteration starts. Every failure (a refused
  key, an unknown model, a crashed subprocess) ends with
  `done { reason: 'failed', error }`.
- There is exactly one `done`, and it is last.
- Aborting `signal` ends the turn with `done { reason: 'cancelled' }` at
  once; the Claude Code subprocess is killed (it exits within a couple of
  seconds of the abort).
- A tool that throws becomes an error result the model reads
  (`isError: true`), not a crash. Tool calls from Claude subagents are
  reported too; subagent text is not.
- `maxSteps` (default 25) caps model round trips: Claude Code's `maxTurns`,
  the Agents SDK's `maxTurns`. Reaching it ends with `max_steps`.

## The Claude engine

Claude Code runs as a subprocess per turn, with:

- **No shell and no files.** Only `WebSearch`, `WebFetch`, `Agent`
  (subagents) and `TodoWrite` are offered, the shell and file tools are
  disallowed, and `permissionMode: 'dontAsk'` denies anything not on the
  allowlist without prompting.
- **Our tools in process.** They are served by an MCP server inside the API
  process (`mcp__oppenheimer__<name>`), with their JSON Schemas as given.
- **An environment built from nothing.** `PATH`, the proxy and CA
  variables, `HOME` and `CLAUDE_CONFIG_DIR` inside `scratchDir`, and the
  provider's variables. Nothing else of the API's environment (its database
  URL, its secrets, a provider key) reaches the subprocess. Every model
  Claude Code would pick on its own (the small model, a subagent's) is set to
  the bot's model.
- **No state between turns.** `settingSources: []`, `persistSession: false`;
  earlier turns are rendered into the system prompt as a delimited
  transcript, because the SDK takes only user prompts as input.

The SDK ships its Claude Code binary as a per-platform optional dependency
(`@anthropic-ai/claude-agent-sdk-linux-x64`, `-linux-x64-musl`, …); the API
image must install the one for its platform.

## Testing

`FakeBotEngine` is for the API's tests. Give it a script per request; it
replays the events under the same contract and ends a script with no `done`
as `completed`. A script never reports a tool's end: every scripted
`tool.started` is followed by the fake's own `tool.finished`, from the
call's `result` when the script gives one, otherwise from running the
request's tool of that name (an unknown name is an error result, as on a
real engine):

```ts
const engine = new FakeBotEngine(() => [
  { type: 'tool.started', callId: 'c1', name: 'remember', input: { fact: 'likes tea' } },
  { type: 'tool.started', callId: 'c2', name: 'WebSearch', input: {}, result: { output: 'hits' } },
  { type: 'text.done', text: 'Noted.' },
]);
```

## Scripts

```bash
pnpm build   # tsc -> dist (CommonJS)
pnpm test    # vitest; the live GLM spec runs only when GLM_API_KEY is set
```

The live spec (`src/__tests__/glm.live.spec.ts`) runs one real turn on
z.ai, model `GLM_MODEL` or `glm-5.3`. Put the key in the test command's
environment only, for example
`node --env-file=<file with GLM_API_KEY> node_modules/vitest/vitest.mjs run`.

## Consumed by

`apps/api` (bots, from slice 2: the turn worker).
