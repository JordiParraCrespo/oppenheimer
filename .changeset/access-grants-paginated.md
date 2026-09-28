---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
---

`GET /v1/access-grants` is paginated, and the scope resolver's grant lookup is
one statement shape.

- **Breaking response shape:** `GET /v1/access-grants` returned every grant in
  the organization as a bare array. It now takes `page` and `limit` (default
  20, at most 100) and answers `{ data, meta }` like the other paginated lists
  (`PaginatedAccessGrantsResponseDto`), newest first. No first-party client
  called it; an API-token script reading the array needs to read `data` and
  follow `meta.totalPages`.
- `findActiveForPrincipals` passes the principals as two arrays through
  `unnest`, so the SQL text no longer changes with how many teams and roles a
  user has (one plan-cache and `pg_stat_statements` entry), and it still reads
  through `IDX_access_grant_lookup`.
