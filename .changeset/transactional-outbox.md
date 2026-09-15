---
"@oppenheimer/backend-ddd": minor
"@oppenheimer/api": minor
---

Add a transactional outbox so domain events and queued jobs can no longer be
silently lost between a database commit and their delivery.

Previously repositories emitted domain events through `EventEmitter2` after the
write, and queued jobs went to BullMQ/Redis outside the Postgres transaction —
so a listener crash, a Redis blip, or a process killed between commit and
dispatch dropped the side effect with no record it was ever owed.

`@oppenheimer/backend-ddd` gains outbox building blocks alongside the existing
aggregate/domain-event bases:

- `OutboxMessageSchema` — a decorator-free `EntitySchema` for the new
  `outbox_message` table. `aggregateId` is a plain column with no foreign key,
  deliberately, so the queue outlives the records it names. Every row carries a
  human-readable `reason` so a queued item is self-explaining.
- `OutboxService` — `stageEvents` / `stageJob` write rows **inside the caller's
  TypeORM transaction**, atomically with the aggregate write; `claim` leases due
  rows with `FOR UPDATE SKIP LOCKED` so multiple API replicas lease disjoint
  rows; leases expire (`lockedUntil`), so work owned by a dead process is
  reclaimed rather than stuck; failures retry with exponential backoff and park
  as `failed` after `maxAttempts` instead of disappearing.
- `OutboxRelay` — the drain loop: a post-commit wake keeps happy-path latency at
  in-process levels, and a background poll is the crash-recovery safety net.
- `DomainEvent` accepts an optional `reason` prop, recorded on the outbox row.

`apps/api` wires it up: an `AddOutbox` migration, a global `OutboxModule`, and
an `OutboxRelayService` that re-emits `event` rows on `EventEmitter2` (keyed by
event class name, so existing `@OnEvent` handlers are unchanged — they now
receive the deserialized payload rather than the class instance) and hands
`queue` rows to the named BullMQ queue. The user, role, API-token and
subscription repositories stage their aggregates' events through the outbox
instead of emitting them directly.

This does not replace BullMQ — it sits in front of it and closes exactly the
`commit(); enqueue();` atomicity gap BullMQ cannot.
