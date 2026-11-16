---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": patch
---

A session can run a second coding agent in a window of its own worktree,
beside the agent in window 0, not only a plain shell.

- `@oppenheimer/shared`: `session.window.open` takes an optional `agent`, any
  catalog coding-agent id but `shell` (`windowAgentSchema`), and runners name
  the new capability `session.window.agent`. `schemas/session-window` adds
  `openSessionWindowBodySchema` and `SessionWindowAgent`.
- `@oppenheimer/runner`: names `session.window.agent` in its hello. An open with
  `agent` makes the window named by the agent's catalog id and launches the
  agent in it as window 0's is at create (folder trusted, executable held), at
  the session's permission level, with its model and effort only when it is
  the session's own agent. A launch that fails kills the window. `shell` and
  ids outside the catalog are refused.
- `@oppenheimer/api`: `POST /v1/sessions/:id/windows` takes an optional body
  `{ agent? }`; no body is still a plain shell. A host whose runner lacks
  `session.window.agent` is refused with `SESSIONS_060`.
- `@oppenheimer/api-client`: regenerated (`OpenSessionWindowRequest`).
- `@oppenheimer/frontend-consumer`: **breaking for callers**:
  `useOpenSessionWindow().mutate` takes `{ sessionId, agent? }` instead of the
  session id; `openWindow(id, agent?)` on the sessions service.
- `@oppenheimer/translations`: `SESSIONS_060` in English and Spanish.
