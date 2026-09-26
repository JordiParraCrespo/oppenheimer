---
"@oppenheimer/frontend-web": minor
---

Split `DataTable` so the search field, the selection and the rows stop sharing a clock: a keystroke now re-renders zero rows. `useTableQuery` keeps one `search` — the settled value — and no longer debounces its URL write.
