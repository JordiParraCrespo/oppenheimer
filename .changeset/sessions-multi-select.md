---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

The sessions sidebar picks several sessions at once: ⌘/Ctrl-click toggles a row, Shift-click spans from the last one, and Select in a row's menu does the same on a touch screen. While rows are picked the Projects line becomes a selection bar that pins, moves to a project or deletes them together; Escape or the bar's close clears it. `SessionItem` takes `selected`, which swaps its glyph for a check box.
