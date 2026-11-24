---
"@oppenheimer/design-system-web": patch
---

`ChatTab`s are one width whatever their names, the way a browser's tabs are:
240px while the strip has room, then all shrinking alike down to 96px as
more open, past which the strip scrolls. Lighting a tab no longer widens it
(its name goes to 500), so clicking one never moves the strip. A strip passed
as `ChatHeader`'s title fills the bar, and the close of a tab not shown takes
no room until it is hovered or focused, so a narrow tab keeps its name.
