---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": patch
---

The console's rail can be put in the reader's own order by dragging.

- `@oppenheimer/web`: the rail's items are sortable; a press still opens the
  list, a drag past 5px or Space picks one up, and the order is kept on this
  device. The items are one table, `RAIL` in `features/sessions/lib/rail-order.ts`.
- `@oppenheimer/design-system-web`: `RailItem` joins a caller's
  `aria-describedby` with its count's, so a `SortableRailItem`'s count is
  still read out beside the drag instructions.
