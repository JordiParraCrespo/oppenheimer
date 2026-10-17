---
"@oppenheimer/web": patch
---

A predicted letter is drawn where the host's echo will draw it. The
overlay laid its glyphs out as CSS text with an estimated padding, which put
them a pixel or two above xterm's own (by face and pixel ratio), so each letter
visibly dropped into place when the echo arrived. It now draws the way the
renderer in use does: on a canvas with the WebGL renderer's own baseline rule,
or as CSS text laid out like the DOM renderer's rows.
