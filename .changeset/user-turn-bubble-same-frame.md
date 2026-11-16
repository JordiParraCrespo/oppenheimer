---
'@oppenheimer/web': patch
---

The reader's message bubble in the session terminal moves in the same frame as
its message. It was laid out a frame after xterm drew the grid, so each time
the agent redrew its screen (every Enter) the bubble sat a frame on the row the
message had left, and the pane jumped.
