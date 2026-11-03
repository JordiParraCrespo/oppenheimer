---
'@oppenheimer/design-system-web': minor
'@oppenheimer/web': minor
---

Plan's Project filter takes several projects. `SearchableFacetMultiSelect`
is `SearchableFacetSelect` over a set: its rows are checks, the popup stays
open while they are toggled, the first row (All projects) clears the set,
and the trigger reads the first pick then `+N`. The board, its counts,
Milestone's options and the Milestones timeline narrow to every project
picked, carried in the address as `?project=web,billing`, so a link to one
project reads as it always did. A card keeps its project's name while
several are picked, and a task added from the board files under the first
of them. The Inbox's Type menu now sets each count apart from its label.
