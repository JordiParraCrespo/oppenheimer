---
'@oppenheimer/shared': minor
'@oppenheimer/runner': minor
'@oppenheimer/api': minor
---

A bot can drive a terminal. `open_terminal` opens a blank-terminal session
on a host. `type_in_terminal` types text there, presses named keys, waits for
a pattern or a few seconds, and returns the screen. `read_terminal` returns
the screen without typing.

On the link this is `terminal.drive` / `terminal.screen`, gated on the new
`terminal.drive` capability. The runner takes it only for a session whose
window 0 is a plain shell, and only when the host's `runner exec` mode is
`full`. Refusals are `EXEC_006` (the mode is not `full`) and `EXEC_007` (the
session is not a blank terminal).
