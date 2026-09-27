---
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/web": patch
---

A deleted session leaves the sidebar once its host has closed it.

- `@oppenheimer/frontend-consumer`: `useSessions` leaves resolved sessions
  (the API's tombstones) out of the list, and polls while a close this console
  asked for has not landed, for up to a minute. `SessionEntity.isResolved` is new.
- `@oppenheimer/web`: the row menu's Move pane names the Unassigned project in
  the reader's language.
