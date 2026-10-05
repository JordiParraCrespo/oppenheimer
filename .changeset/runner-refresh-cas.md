---
"@oppenheimer/runner": patch
---

A refresh no longer overwrites a stop or a close, and polling costs less.

- A session refresh is a compare-and-set: it is dropped when a command wrote
  the session while it looked, or is still working on it, and it never moves
  a session out of `stopped` or `closed`. A close that raced a refresh no
  longer comes back as `working` and then `stopped`, so the console no longer
  shows a second `session.stopped` after a close or an ordered stop.
- The session map is written only when a session changed; a quiet poll writes
  nothing.
- The poll loop lists the tmux server once per tick (`list-panes -a`) and runs
  one `capture-pane` per live session, instead of `has-session`,
  `capture-pane` and `display-message` for each.
- Tool versions and the macOS version are cached per executable (path, mtime,
  size) with a 10-minute backstop; a preflight probes afresh.
- Concurrent credential-helper calls for one session share a single
  `credentials.token` ask, and one caller giving up does not fail the others.
