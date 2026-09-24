---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": patch
---

Opening a session from the sidebar no longer waits on a read of a row the list
already holds.

- `@oppenheimer/frontend-consumer`: `useSession` fills its first answer from the
  session list's row, stamped with the list's read time, so within the stale
  window the pane renders on the click with no request, and past it renders the
  row at once and reads again behind it. New `usePrefetchSession` reads a session
  ahead of the click through the same query options; it skips a fresh entry, a
  Save-Data or 2G connection, and a third read in flight, and fails silently.
- `@oppenheimer/web`: a sidebar row prefetches its session when the pointer or
  focus lands on it.
