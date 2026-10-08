---
"@oppenheimer/backend-ddd": minor
---

Add `TypeOrmRepositoryBase.saveIf(entity, condition)`, a conditional write: one `UPDATE` that must affect exactly one row, staging the aggregate's events only when it wins and calling its `markPersisted()` (the new `PersistenceTracked` contract) then; it answers whether the write won.
