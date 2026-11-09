---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web-showcase": patch
---

To do's rows are picked up by the pointer anywhere on the card, not only by
the six-dot grip; the done toggle never lifts the row, and a press on the
title that moves under 5px is still a click that opens the task. The grip stays the keyboard's handle and,
on a touch screen, the part that drags instead of scrolling.

- `@oppenheimer/design-system-web`: `useSortableItem` returns `pointerProps`,
  for a box bigger than the handle; `SortableTodoRow` spreads them on the row.
- `@oppenheimer/web-showcase`: the TodoRow entry says so.
