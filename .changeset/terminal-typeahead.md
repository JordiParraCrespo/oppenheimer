---
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
---

The session terminal predicts what you type.

- `@oppenheimer/web`: predictive local echo. A character typed at the cursor,
  Backspace, Left and Right are drawn at once in an overlay over the grid and
  dropped the moment the host's output disagrees; Up, Down, Enter and every
  other key go to the program unpredicted and start a new epoch, whose first
  key waits for the host (so a prompt that does not echo, a password, is never
  drawn). It draws only while the measured keystroke round trip is above
  30 ms. The round trip is measured in the browser, and setting
  `localStorage['oppenheimer.terminal.latency'] = '1'` shows it in the pane's
  corner as `echo p50 / p95 ms`.
- `@oppenheimer/shared`: the `terminal_typeahead` flag, an `ops` kill switch,
  on by default.
