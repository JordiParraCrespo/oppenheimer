---
"@oppenheimer/backend-ddd": minor
---

Add transactional-outbox building blocks alongside the existing
aggregate/domain-event bases, so domain events and queued jobs can no longer be
silently lost between a database commit and their delivery.

- `OutboxMessageSchema` — a decorator-free `EntitySchema` for the
  `outbox_message` table. `aggregateId` is a plain column with no foreign key,
  deliberately, so the queue outlives the records it names. Every row carries a
  human-readable `reason` so a queued item is self-explaining.
- `OutboxService` — `stageEvents` / `stageJob` write rows **inside the caller's
  TypeORM transaction**, atomically with the aggregate write; `claim` leases
  due rows with `FOR UPDATE SKIP LOCKED` so multiple API replicas lease
  disjoint rows; leases expire (`lockedUntil`), so work owned by a dead process
  is reclaimed rather than stuck; failures retry with exponential backoff and
  park as `failed` after `maxAttempts` instead of disappearing.
- `OutboxRelay` — the drain loop: a post-commit wake keeps happy-path latency
  at in-process levels, and a background poll is the crash-recovery safety net.
- `DomainEvent` accepts an optional `reason` prop, recorded on the outbox row.
