---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
---

A session's terminal windows are a request and a reply, so the side pane's
Terminal tab can list, open and close plain shells in a session's worktree
(tmux windows 1 and up; window 0 is the agent) and attach to the one it opened.

- `@oppenheimer/shared`: the link gains `session.windows.list` and the reply
  `session.windows` (`{ windows: [{ index, name }], opened? }`, the snapshot's
  window shape, now `sessionWindowSchema`), and the runner capability
  `session.windows.list`. `schemas/session-window` holds the API's shapes
  (`SessionTerminalWindow`, `SessionWindowsResponse`,
  `OpenedSessionWindowResponse`, `ClosedSessionWindowResponse`).
- `@oppenheimer/runner`: names `session.windows.list` in its hello and answers
  `session.windows.list`, `session.window.open` and `session.window.close`
  with `session.windows`, the windows tmux lists after the command (the open's
  window as `opened`); refusals stay `command.failed`.
- `@oppenheimer/api`: `GET /v1/sessions/:id/windows` (`sessions:read`),
  `POST /v1/sessions/:id/windows` and `DELETE /v1/sessions/:id/windows/:window`
  (`sessions:write`), owner only; `SESSIONS_056`–`SESSIONS_059`. Window
  commands are no longer remembered for the session's log: their refusal is
  the request's answer.
- `@oppenheimer/api-client`: regenerated (`findSessionWindows`,
  `openSessionWindow`, `closeSessionWindow`).
- `@oppenheimer/frontend-consumer`: `listWindows`, `openWindow` and
  `closeWindow` on the sessions service; `useSessionWindows`,
  `useOpenSessionWindow` and `useCloseSessionWindow`.
