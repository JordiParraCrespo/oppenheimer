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
  online. The band under the terminal is the design system's
  `HostLinkChrome`: a banner while the host is away (offline, catching up,
  reconnected) with the time offline and How to fix, which opens the commands
  to copy and the link to Settings → Hosts. Retry now is offered only for a
  blip.
- `@oppenheimer/translations`: `sessions.session.hostLink.*`; the stream's
  status words other than `closed` go.
