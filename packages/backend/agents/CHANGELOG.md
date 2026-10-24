# @oppenheimer/backend-agents

## 0.1.0

### Minor Changes

- ac929fa: Bots on a ChatGPT subscription (`product/versions/mvp/25-bots.md` §2): a fourth
  provider, `chatgpt`, signed in rather than given a key, the way OpenClaw and the
  Codex CLI do it.

  - Settings → Model providers has a ChatGPT row with Connect ChatGPT: OpenAI's
    device code flow, a one-time code typed on OpenAI's page, polled until the
    person approves it (`POST /v1/model-providers/chatgpt/login` and
    `…/login/poll`). The sign-in's tokens are sealed like a key.
  - `ChatgptBotEngine`, the OpenAI engine with ChatGPT's Codex backend as its
    endpoint: the account header, `store: false` and encrypted reasoning.
  - The worker refreshes the token before a turn when it is about to lapse, one
    refresh per workspace at a time, written only over the tokens it read; a
    refresh ChatGPT refuses removes the sign-in.
  - New problems `BOTS_017`–`BOTS_021`; `PUT /model-providers/chatgpt` answers
    `BOTS_017`.

- 8f93026: New package: the engines a bot's turn runs on (`product/versions/mvp/25-bots.md`
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
