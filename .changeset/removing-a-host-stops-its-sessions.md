---
"@oppenheimer/runner": patch
"@oppenheimer/web": patch
"@oppenheimer/design-system-web": patch
"@oppenheimer/translations": patch
---

Removing a host stops its sessions on the machine, as the remove dialog says.

- `@oppenheimer/runner`: the unpaired verdict (HTTP 410 or a 4410 close) also
  ends every tmux session the runner owns and records it stopped; checkouts
  stay on disk. A dropped link still leaves sessions running.
- `@oppenheimer/web`: a deleted session's pane says it was deleted rather than
  that its work is on its branch.
- `@oppenheimer/design-system-web`: `SessionItem` rendered as a link is not a
  native button, which Base UI warned about on every sidebar row.
- `@oppenheimer/translations`: `sessions.closed.deleted`, and the remove-host
  dialog's one-session sentence is singular.
