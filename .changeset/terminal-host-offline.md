---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

A session's terminal says what to do when its host is offline, and redials
when the host is back.

- `@oppenheimer/frontend-consumer`: `useHostPresence` takes `watching` (polls
  only while it holds) and `select`, so a pane can watch one host on the same
  `hostPresence` poll Settings → Hosts uses.
- `@oppenheimer/web`: `useTerminal` takes `hostId`; while the link is offline
  it watches that host and redials once a poll answered after the drop finds it
  online. The pane shows `HostOfflineNotice` instead of offering Retry now.
- `@oppenheimer/translations`: `sessions.session.offline.*`.
