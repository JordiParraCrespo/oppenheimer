---
'@oppenheimer/design-system-web': minor
---

Every picker built on `ChipSelectSearch` answers the arrow keys: ↑ and ↓ move a highlight across its options while the focus stays in the search, and Enter picks the highlighted one. `RepositorySelect`, `FieldSelect`, `RepositoryAddField` and `RepositoryRowList` get it with no change at their call sites.
