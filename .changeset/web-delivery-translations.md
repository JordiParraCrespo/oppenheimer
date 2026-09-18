---
"@oppenheimer/translations": minor
---

Add two narrower entrypoints so only the default locale reaches the critical
path: `/locales` for metadata and `/lazy` for one catalog per chunk. Importing
`locales` or `Messages` from the root barrel put every catalog in the entry
chunk — the Spanish catalog was measurably inside what an English reader
downloaded before anything rendered.

Declare `sideEffects`, worth ~7KB gzipped to consumers.
