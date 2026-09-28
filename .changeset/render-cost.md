---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/frontend-web": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/web": patch
---

- `@oppenheimer/frontend-core`: `useQuery` and `useQueries` that share entities across refetches.
- `@oppenheimer/frontend-consumer`: every query hook goes through them.
- `@oppenheimer/frontend-web`: `createDialogSlot` replaces `ConsoleDialogProvider`, `useConsoleDialog` and `useConsoleList`; `SidebarSearchField` is added.
- `@oppenheimer/design-system-web`: `FieldSelect` no longer reads a ref in render.
- `@oppenheimer/web`: fewer re-renders in the sidebars and the project dialog.
