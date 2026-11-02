---
"@oppenheimer/cli": minor
"@oppenheimer/mcp": minor
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
---

`opp` and the MCP server: people, scripts and agents on other hosts drive
Oppenheimer over the API (`product/next-steps/0.6-mcp-cli-and-agent.md`).

- `@oppenheimer/cli`: new. `opp hosts`, `projects`, `sessions
  list|get|run|send|wait|stop|close`, `automations
  list|create|run|pause|resume|delete`, `bots list|chat`, `tasks
  list|add|move`, `tokens` and `mcp install|status`, on a scoped API token
  that `opp login` pins to the caller's workspace. Built from the Flama
  boilerplate's `cli` plugin.
- `@oppenheimer/mcp`: new. The same verbs as MCP tools over stdio and
  Streamable HTTP, offered only when the credential's scopes cover them.
  Built from the Flama boilerplate's `mcp` plugin; a blank variable in the
  environment now reads as unset.
- `@oppenheimer/api`: `POST /v1/sessions/{id}/prompt` types a follow-up
  prompt into a session's agent for a person's credential (`sessions:write`),
  the command the bots already use, logged as `{ kind: 'person', userId }`,
  and answers `{ seq, session }`: where the prompt landed in the log.
- `@oppenheimer/shared`: `sendSessionPromptSchema`, and in
  `@oppenheimer/shared/sessions` what both clients launch and wait with:
  `sessionLaunchBody`, `pickProjectCheckout`, `isSessionSettled`,
  `agentTookWorkAfter` and `isWorkSettled`.
- `@oppenheimer/api-client`: `sendSessionPrompt` and
  `SentSessionPromptResponseDto`.
