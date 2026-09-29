---
"@oppenheimer/api": patch
---

Squash the 51 migrations into one baseline, `InitialSchema`
(`1790900000000-InitialSchema.ts`), which produces the identical schema, and
remove `apps/api/db/ops/` with its hand-run index scripts and rollbacks.
Nothing had been deployed. A local database created before this change must
be dropped and recreated: its migrations table names migrations that no longer
exist.
