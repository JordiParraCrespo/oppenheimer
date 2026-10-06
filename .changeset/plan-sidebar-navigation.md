---
"@oppenheimer/web": patch
---

Plan: moving between the board and the calendar from the sidebar no longer
breaks the screen. The console picks its list from the matched routes rather
than the address, which moves on while the next route still loads; Plan's two
sidebars load together, and a swap that still waits draws nothing under the
nav instead of the previous list. The board's gutter is on its header and
goals strip, so the columns run to the edge of the page's column.
