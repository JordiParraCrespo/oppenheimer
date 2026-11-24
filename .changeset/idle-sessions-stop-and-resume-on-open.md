---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": patch
---

Idle sessions free their memory on their own, and coming back to one is
opening it.

- `@oppenheimer/runner`: every 5 minutes, the daemon stops each session whose
  agent has been `done` or `idle` for 2 hours, with no terminal attached and
  nothing typed into it. It stops and never closes, on the same path as Stop:
  the agent's processes go, and the checkout, branch and conversation stay.
  It looks at the agent afresh before each stop. It never stops a working or
  blocked agent, a session with a second agent in another window, an
  attached session (a console
  attach, or a tmux client on the host), a kept session, a child whose parent
  is live, or a parent with a child that is not idle too. Each stop is
  logged ("stopped an idle session"). `RUNNER_IDLE_STOP` sets the window (a Go
  duration) or turns it `off`, and the service unit carries it.
- `@oppenheimer/web`: opening a stopped session as its owner restarts it,
  showing Restarting until the terminal is back, when its host is online. A
  restart that fails, or that the host does not bring back within a minute,
  falls back to the stopped pane with Restart and the reason (the Restart
  button now waits for the terminal the same way). A sidebar row, a hovered
  link, a route preload, a shared view, a deleted session and an offline
  host restart nothing, nor does a session that stops while its page is open,
  or one shown in another session's side pane.
- `@oppenheimer/frontend-consumer`: `RESTART_WATCH_MS` is exported, so the
  pane gives up when the restart watch does.
