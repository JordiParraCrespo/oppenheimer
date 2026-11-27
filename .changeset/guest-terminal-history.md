---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A view-only guest on a shared session can scroll its terminal back. Its
wheel never reaches tmux (a read-only client), and tmux's copy mode is the
pane's, so scrolling there would move the owner's view: the guest's first
notch up asks the host for the pane's scrollback instead (`history.ask` on
the attach socket, `attachment.history` on the link, capability
`attachment.history`), read with `capture-pane -e` (up to 5,000 lines, its
last 384 KiB), and the console draws it over the live grid with its
colours. Scrolling to its end, Escape or Back to live returns to the live
pane, which never stopped following.
