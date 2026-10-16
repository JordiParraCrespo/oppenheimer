---
"@oppenheimer/backend-agents": minor
---

New package: the engines a bot's turn runs on (`product/versions/mvp/25-bots.md`
§2, slice 2).

- One `BotEngine` port and `createBotEngine()`, which routes by provider:
  `anthropic` and `glm` (z.ai's Anthropic-compatible endpoint) on the Claude
  Agent SDK, `openai` on the OpenAI Agents SDK.
- One event stream for both: text deltas and blocks, tool steps under our
  tool names, usage, and exactly one `done` (`completed`, `cancelled`,
  `max_steps` or `failed`). It never throws; an abort cancels at once and
  kills the Claude subprocess; no error carries the API key.
- The Claude engine runs without its shell and file tools, with our tools
  served in process over MCP and an environment built from an allowlist, so
  none of the API's own secrets reach it.
- Keys are passed per call and never read from the environment.
- `FakeBotEngine` replays scripted turns, running the tools the script
  calls, for the API's tests.
