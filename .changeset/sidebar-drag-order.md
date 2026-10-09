---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web-showcase": patch
"@oppenheimer/translations": patch
---

The console's sidebar reorders by dragging: a project by its header among
the others (`SortableSidebarProjectGroup`), and a session within its project
or into another one, which moves it there. The order is kept on the device,
and the sort menu gains Custom order, its new default.
`useSortableGroups` tells `onChange` when a drag settles and hands `onMove`
the value it settled on; a session write stays pending until the session
lists have refetched.
