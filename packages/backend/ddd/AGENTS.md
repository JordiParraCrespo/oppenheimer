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
├── repository.port.ts          # repository port interface
├── mapper.interface.ts         # domain <-> persistence mapper contract
├── persistence/
│   └── timestamp-columns.ts    # TimestampColumn, CreatedAtColumn, UpdatedAtColumn (timestamptz)
├── outbox/
│   ├── outbox-message.ts       # outbox row types + EntitySchema (outbox_message)
│   ├── outbox.service.ts       # transactional staging + SKIP LOCKED leasing
│   └── outbox-relay.ts         # drain loop (wake + poll), publisher contract
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
  transaction** as the aggregate write; `OutboxRelay` (hosted by the app)
  claims rows with `FOR UPDATE SKIP LOCKED`, so replicas lease disjoint rows
  and expired leases are reclaimed. The `outbox_message` table is created by a
  migration in the consuming app, mirroring `OutboxMessageSchema`.

## Commands

```bash
pnpm --filter @oppenheimer/backend-ddd build
pnpm --filter @oppenheimer/backend-ddd dev
```
