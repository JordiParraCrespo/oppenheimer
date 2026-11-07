---
'@oppenheimer/runner': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/design-system-web': minor
'@oppenheimer/translations': minor
'@oppenheimer/web': minor
---

A session's chat shows its subagents as they work. The runner follows each
subagent's own conversation beside the session's (Claude Code's
`subagents/agent-<id>.jsonl` and its meta, Codex's child rollouts by
`parent_thread_id`, OpenCode's `task` conversations through its API) and
sends its lines marked `isSidechain` with `agentId`, plus an
`oppenheimer.subagent` entry naming the call that started it, its kind,
model, state and tokens. A Codex subagent's rollout is no longer taken for
the session's own conversation. The console puts each subagent into its
call (`ChatToolCall.subagent`) and draws calls that started subagents as a
`SubagentRunCard`, a row each with its task, kind, model, clock, current
activity or outcome, calls and tokens; `SubagentRow` takes `children`,
which the row's name folds.
