---
'@oppenheimer/runner': patch
'@oppenheimer/web': patch
---

A session opens on its chat without a jump. The runner's first word on a
conversation with nothing written yet went as `entries: null`, which the
control plane refuses, so the console showed the raw terminal until the
agent's first line and then swapped it for the chat; it now goes as an empty
list and the chat is there as soon as the terminal attaches. The view switch
reads Chat / Terminal, Chat first, as the view a session opens on, and the
session's placeholder is the pane's own ground instead of a grey slab.
