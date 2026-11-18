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
  catalog coding-agent id but `shell` (`windowAgentSchema`), with the optional
  `model`, `effort` and `permission` picked for it (the launch's bounds) and a
  first `prompt` (`session.create`'s bound, now the named `promptText`), and
  runners name the new capability `session.window.agent`.
  `schemas/session-window` adds `openSessionWindowBodySchema` (the launch
  schema plus `agent`) and `SessionWindowAgent`.
- `@oppenheimer/runner`: names `session.window.agent` in its hello. An open with
  `agent` makes the window named by the agent's catalog id and launches the
  agent in it as window 0's is at create (folder trusted, executable held),
  with the model, effort and permission the open picked; each one not picked
  is the session's (its permission level always, its model and effort only for
  the session's own agent), and the first task as its trailing positional. A
  failed `tmux respawn-pane` names the window and no longer the command line,
  which carries the person's task. A launch that fails kills the window. `shell` and
  ids outside the catalog are refused.
- `@oppenheimer/api`: `POST /v1/sessions/:id/windows` takes an optional body
  `{ agent?, model?, effort?, permission?, prompt? }`; no body is still a plain
  shell, and the launch fields and the prompt go to the host only with `agent`. A host whose runner lacks
  `session.window.agent` is refused with `SESSIONS_060`.
- `@oppenheimer/api-client`: regenerated (`OpenSessionWindowRequest`).
- `@oppenheimer/frontend-consumer`: **breaking for callers**:
  `useOpenSessionWindow().mutate` takes
  `{ sessionId, agent?, model?, effort?, permission?, prompt? }` instead of the session
  id; `openWindow(id, input?: OpenSessionWindowInput)` on the sessions
  service. The launch fields and the prompt are sent only with an agent that is
  not `shell`.
- `@oppenheimer/translations`: `SESSIONS_060` in English and Spanish.
