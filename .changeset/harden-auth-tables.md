---
"@oppenheimer/api": minor
---

Foreign keys and indexes for Better Auth's `session` (`impersonatedBy`, `activeOrganizationId`, `activeTeamId`), a unique provider-account key on `account`, indexes on `verification` and the missing foreign-key indexes on `invitation`, and readable names for the first migration's constraints. Large databases run `apps/api/db/ops/1790300000000-harden-auth-tables.sql` first.
