---
'@oppenheimer/shared': minor
'@oppenheimer/frontend-consumer': patch
'@oppenheimer/web': patch
---

A session's chat shows what a slash command the CLI answers itself printed
(`/context`, `/cost`, `/model`) under the prompt that ran it, on the
terminal's ground in its font with the spacing kept and the colour codes
taken out; stderr is red. It was read only as the turn having ended, so
`/context` showed its prompt and nothing under it, and a turn that folds
keeps it. `SessionChat`'s turns carry it as an `output` step, and a
session's chat items as an event of its own: the chat item model's
`event` takes `command_output`.
