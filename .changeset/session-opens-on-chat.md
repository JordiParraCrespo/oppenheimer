---
'@oppenheimer/runner': patch
'@oppenheimer/web': patch
---

A session's chat is there as soon as its terminal attaches. The runner's
first word on a conversation with nothing written yet went as
`entries: null`, which the control plane refuses, so the chat was not
offered until the agent's first line; it now goes as an empty list. The
session's placeholder is the pane's own ground instead of a grey slab.
