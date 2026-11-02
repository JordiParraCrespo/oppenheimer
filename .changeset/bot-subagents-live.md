---
'@oppenheimer/shared': minor
'@oppenheimer/backend-agents': minor
'@oppenheimer/api': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/translations': minor
'@oppenheimer/web': minor
---

A bot's chat shows the subagents of a running `delegate` call as they work.
The bot's stream sends a `subagents` frame (each child's task, state, the
tools it has called, its start and duration) each time one moves, keyed by
the call's id, which the engines now hand each tool call
(`BotEngineToolCall`). The console hangs a line per child under "Running 3
subagents", with its clock or how it ended and a fold listing its tools,
until the stored step replaces them. `useBotLiveText` is now `useBotLive`,
returning `{ text, subagents }`.
