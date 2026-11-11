---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/cli": minor
"@oppenheimer/mcp": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
---

Hidden sessions: a session can be kept out of the console's sidebar and
shown again, and it runs the same either way
(`product/next-steps/hidden-sessions.md`).

- `@oppenheimer/api`: a `session.visibility_set` log entry folded into
  `work_session.hidden` (migration `AddSessionHidden`).
  `PUT /sessions/{id}/visibility` hides or shows a session. `POST /sessions`
  and `POST /sessions/cloud` take `hidden`, and the session response carries
  it. The bots' `start_session` and `start_cloud_session` take `hidden`.
- `@oppenheimer/shared`: `createSessionSchema` and `startCloudSessionSchema`
  gain `hidden`; `setSessionVisibilitySchema`; `sessionLaunchBody` takes
  `hidden`.
- `@oppenheimer/frontend-consumer`: `SessionEntity.hidden`,
  `sessions.setHidden` and `useSetSessionHidden`.
- `@oppenheimer/frontend-web`: `useStoredBoolean`, a boolean kept on this device; Pinned only and Show hidden sessions read through it.
- `@oppenheimer/web`: Hide / Show in a session row's menu. The filter menu
  gains Show hidden sessions, with a count. While it is on, hidden sessions
  are listed marked Hidden.
- `@oppenheimer/cli`: `opp sessions run --hidden`, `opp sessions hide <id>`,
  `opp sessions show <id>`.
- `@oppenheimer/mcp`: `start_session` takes `hidden`; `set_session_visibility`.
- `@oppenheimer/translations`: `sessions.sidebar.hide`, `show`, `hidden`;
  `sessions.filters.showHidden`; the toasts `sessionHidden` and `sessionShown`.
