---
"@oppenheimer/backend-core": minor
"@oppenheimer/api": patch
"@oppenheimer/api-client": patch
---

User and role search match `%` and `_` literally.

- Added `likeContains(term)` to `@oppenheimer/backend-core`: an `ILIKE`
  contains-pattern with the term's `%`, `_` and `\` escaped.
- `GET /v1/users?search=` and `GET /v1/roles?search=` use it, so `a_b` no
  longer matches `axb` and `%` no longer matches every row. `search` is trimmed
  and capped at 100 characters (documented as `maxLength` in the OpenAPI
  document; a longer term is a 400).
