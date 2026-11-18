---
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

The sessions sidebar's filter menu finds what needs you: a Status facet
(All statuses, Needs input, Ready for review) narrows the list to the rows
whose dot is amber or blue, with a chip like the other facets, and Sort by
gains Needs input first (needs input, then ready for review, then the rest,
each newest first).

- `@oppenheimer/translations`: `sessions.filters` gains `status`,
  `allStatuses` and `statuses`; `sessions.sort` gains `attention`.
