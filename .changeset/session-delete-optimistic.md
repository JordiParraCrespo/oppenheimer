---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/runner": minor
"@oppenheimer/translations": patch
---

Deleting a session feels immediate, and a session gone from its host no
longer gets stuck.

- `@oppenheimer/frontend-consumer`, `@oppenheimer/web`: the sidebar drops a
  session the moment Delete is confirmed and keeps it out until its host
  resolves it. The row comes back when the close cannot happen: the API
  refuses it, the host is offline (`SESSIONS_CLIENT_019`, shown in the
  dialog), or the host has not resolved it within a minute. The "asked the
  host to delete" toast is gone. A restart's watch also ends when the
  session resolves.
- `@oppenheimer/runner`: a close or a restart for a session this host holds
  no record of, one already closed here, or one whose worktree was deleted
  by hand closes it and reports `session.closed`, so its row resolves. A
  restart of such a session is still refused.
- `@oppenheimer/translations`: `errors.byCode.SESSIONS_CLIENT_019`; the
  `toasts.sessionDeleteRequested` key is removed.
