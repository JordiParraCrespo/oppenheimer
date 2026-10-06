---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web-showcase": patch
---

The sidebar's sessions reorder by dragging, inside a project or into another
one (`SortableSessionItem`). A sortable row that is also a link picks up on
Space so Enter still opens it, and the screen reader is told so
(`useSortableControl`).
