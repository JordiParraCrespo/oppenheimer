---
"@oppenheimer/web": patch
---

The session terminal's cursor no longer blinks while typing ahead of the host.
Each echo cleared the predicted cursor at once, while the terminal's own
cursor came back only once xterm had parsed its show, so every key left a
frame with no cursor at all. The predicted cursor now stays until the
terminal's is back.
