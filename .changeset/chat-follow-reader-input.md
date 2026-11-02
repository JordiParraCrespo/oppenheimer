---
'@oppenheimer/design-system-web': patch
---

`useStickToBottom` lets go of the end only when the reader scrolls up: a
wheel turned up, a touch, an up key, or a press on the scrollbar. When content
shrinks for a frame, the browser clamps the view up itself and reports that a
frame later, by which time the content may have grown back. The hook read
that as the reader leaving the end, so a long session chat could stop one
screen short of its end while its history loaded, with "Jump to latest"
showing. A move up the reader did not make now scrolls back to the end.
