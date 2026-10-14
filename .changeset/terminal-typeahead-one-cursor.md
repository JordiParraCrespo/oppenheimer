---
"@oppenheimer/web": patch
---

Typing ahead of a slow host shows one cursor. While a prediction is drawn the
terminal's own cursor, which marks how far the host has echoed, is hidden
(tmux's re-show at the end of each redraw included) and comes back once the
host catches up; drawn under the predicted one it read as a second cursor
trailing the first. The overlay also reads the cell size off the screen's
fractional box rather than its rounded `clientWidth`, so a guess no longer
drifts off the host's columns towards the right of the line.
