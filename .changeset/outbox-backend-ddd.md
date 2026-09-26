---
"@oppenheimer/backend-ddd": minor
---

Add transactional-outbox building blocks: `OutboxMessageSchema`, an `OutboxService` that stages inside the caller's transaction and leases claims with `FOR UPDATE SKIP LOCKED`, and `OutboxRelay`.
