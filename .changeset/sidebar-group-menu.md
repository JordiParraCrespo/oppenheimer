---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/frontend-consumer": minor
---

A sidebar group's header has a menu, at its ellipsis or on a right-click:
hide every session the group lists (or show them again once all are hidden),
or delete them all after the dialog for several asks.

- `@oppenheimer/web`: `GroupSessionsMenu` on each project group, the group of
  sessions with no listed project, and Pinned.
- `@oppenheimer/design-system-web`: `SidebarProjectHeader` takes `menuOpen`,
  which keeps its actions shown while a menu among them is open.
- `@oppenheimer/frontend-web`: `SidebarPinnedGroup` takes `actions`,
  `onContextMenu` and `menuOpen` for its head.
- `@oppenheimer/translations`: `sessions.group.*`, and the `sessionsHidden`
  and `sessionsShown` toasts.
- `@oppenheimer/frontend-consumer`: `useSetSessionsHidden` hides or shows
  several sessions in one batch, four writes in flight at a time and one
  re-read of the list at the end.
