---
"@oppenheimer/api": minor
---

Foreign keys, indexes and a unique provider-account key on Better Auth's `session`, `account` and `verification` tables, and the missing foreign-key indexes on `invitation`; a user's sessions and logins now go with the user. Large databases run `apps/api/db/ops/1790000000000-harden-auth-tables.sql` first.
