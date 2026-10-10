# @oppenheimer/backend-ddd — Agent Instructions

Domain-Driven Hexagon building blocks used by `apps/api`. Framework-agnostic —
depends on nothing in the workspace; `@oppenheimer/backend-core` depends on
this package, not the other way around.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md), [`apps/api/ARCHITECTURE.md`](../../../apps/api/ARCHITECTURE.md),
> and [`.agents/rules/nestjs-architecture.md`](../../../.agents/rules/nestjs-architecture.md).

## Building blocks

```
src/
├── aggregate-root.base.ts      # AggregateRoot base (emits domain events)
├── entity.base.ts              # Entity base
├── value-object.base.ts        # ValueObject base
├── domain-event.base.ts        # DomainEvent base
├── command.base.ts             # CQRS command base
├── query.base.ts               # CQRS query base
├── repository.port.ts          # repository port interface (insert/save/findOneById/delete), Paginated
├── typeorm-repository.base.ts  # non-tenant TypeORM adapter base: the port's four methods over writeWithEvents, saveIf (conditional write)
├── mapper.interface.ts         # domain <-> persistence mapper contract
├── outbox/
│   ├── outbox-message.ts       # outbox row types + EntitySchema (outbox_message), TIMESTAMP_COLUMN_TYPE
│   ├── outbox.service.ts       # transaction() + staging (wakes after commit), SKIP LOCKED leasing, retention delete
│   └── outbox-relay.ts         # coalescing drain loop (wake + poll), publisher contract
├── request-context.service.ts  # request-scoped context
├── exceptions.ts               # domain exceptions
├── guard.ts                    # invariant guards
└── utils.ts
```

## Conventions

- Ships **CommonJS**. Library package (no runtime services to plug in).
- These base classes define the contracts every `apps/api` module extends:
  aggregates, entities, value objects, commands/queries, ports, and mappers.
- Prefer changing a base here over duplicating patterns in modules — but treat
  the public surface as stable; many modules depend on it.
- The transactional outbox (`outbox/`) is the durability layer for domain
  events and queued jobs: repositories stage rows via
  `OutboxService.stageEvents` / `stageJob` **inside the same TypeORM
  transaction** as the aggregate write, opened with `OutboxService.transaction`
  (or `writeWithEvents` for a single write), which wakes the relay after
  commit when something was staged and never after a rollback;
  `OutboxRelay` (hosted by the app) claims rows with `FOR UPDATE SKIP LOCKED`, so replicas lease disjoint rows
  and expired leases are reclaimed. A claimed batch is published concurrently
  (bounded by `batchSize`, settled with `Promise.allSettled`), so rows carry
  no delivery order a listener may rely on. While it delivers a batch the relay renews
  the lease (`extendLease`, a heartbeat at a third of the lease), and the marks
  that end a delivery only touch rows the relay still owns. `wake()` is fire-and-forget: it asks the
  relay for a drain and returns without waiting for delivery; at most one
  drain runs, and wakes during it collapse into one more pass. Delivery is at
  least once. `stageJob` takes the correlation id from its caller (a command's
  or an event's `metadata.correlationId`, `null` for a sweep) and never reads
  ambient context; `backlog()` reads pending, failed and the oldest pending row
  in one index-backed statement. `markProcessed` returns the ids it still owned,
  and only those count as delivered. `deleteProcessedBefore` is the retention delete the app
  schedules. The `outbox_message` table is created by a migration in the
  consuming app, mirroring `OutboxMessageSchema`.

## Commands

```bash
pnpm --filter @oppenheimer/backend-ddd build
pnpm --filter @oppenheimer/backend-ddd dev
pnpm --filter @oppenheimer/backend-ddd test
```
