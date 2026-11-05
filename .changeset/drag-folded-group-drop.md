---
"@oppenheimer/design-system-web": patch
---

A drop into a folded group lands again. The drag layer keeps the carried item's data from when it was picked up, so once a row carried into a group that draws no rows (a folded project in the console's sidebar) unmounts, its `type` still matches the group's `accepts`. Before, dnd-kit handed back empty data, no target took the item, and the drop went nowhere: a session dragged into a folded project was never moved.
