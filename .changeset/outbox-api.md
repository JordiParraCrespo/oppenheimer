---
"@oppenheimer/api": minor
---

Wire up the transactional outbox. Previously repositories emitted domain events
through `EventEmitter2` after the write, and queued jobs went to BullMQ/Redis
outside the Postgres transaction — so a listener crash, a Redis blip, or a
process killed between commit and dispatch dropped the side effect with no
record it was ever owed.

An `AddOutbox` migration, a global `OutboxModule`, and an `OutboxRelayService`
that re-emits `event` rows on `EventEmitter2` (keyed by event class name, so
existing `@OnEvent` handlers are unchanged — they now receive the deserialized
payload rather than the class instance) and hands `queue` rows to the named
BullMQ queue. The user, role, API-token and subscription repositories stage
their aggregates' events through the outbox instead of emitting them directly.

This does not replace BullMQ — it sits in front of it and closes exactly the
`commit(); enqueue();` atomicity gap BullMQ cannot.
