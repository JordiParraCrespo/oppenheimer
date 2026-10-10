---
"@oppenheimer/backend-ddd": minor
---

Add `TypeOrmRepositoryBase.saveIf(entity, condition)`, a conditional write for an aggregate that is `PersistenceTracked`: one `UPDATE` on the manager of an `OutboxService.transaction`, whatever the aggregate owes. Only when it affected exactly one row are the aggregate's events staged (and the relay woken after commit), then cleared, and its `markPersisted()` called; a lost race stages nothing, wakes nothing and leaves the events. It answers whether the write won.
