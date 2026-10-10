---
"@oppenheimer/web": minor
---

The session terminal draws a typed key before the relay brings its echo back,
the way mosh does: predictions are an overlay over the grid, shown only once
the program has echoed a key on the line (so a password prompt is never
painted), dropped when the real echo lands, and switched off for a second
after a wrong guess. Typing behind a 60 ms edge goes from about 126 ms per key
to about 2 ms.
