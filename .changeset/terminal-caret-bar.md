---
"@oppenheimer/web": patch
---

The session terminal's cursor is a text field's caret: a one-pixel bar,
focused or not, instead of a block (a hollow block when the pane is not
focused). A program can still ask for another shape. A predicted cursor draws
as the same bar while the program shows the terminal's cursor, and as a block
where the program paints its own (Claude Code's inverse cell).
