# @oppenheimer/backend-ddd

Domain-Driven Hexagon building blocks for the API. Framework-agnostic — it has
**no NestJS dependency** — so the domain layer stays pure. (TypeORM is a
dependency only for the outbox building blocks; the domain bases don't
touch it.) `Result`-based error
handling comes from [`oxide.ts`](https://github.com/traverse1984/oxide.ts).

See [`apps/api/ARCHITECTURE.md`](../../../apps/api/ARCHITECTURE.md) for how these
pieces fit the layer model, and `.agents/rules/nestjs-architecture.md` for usage
rules.

## What's inside

- **Tactical patterns**: `Entity`, `AggregateRoot`, `ValueObject`, and their
  prop/ID types (`AggregateID`, `BaseEntityProps`, `CreateEntityProps`,
  `DomainPrimitive`, `Primitives`).
- **CQRS bases**: `CommandBase`, `QueryBase`, `DomainEvent` (+ their metadata/props types).
- **Ports**: `RepositoryPort` (`insert`, `save`, `findOneById`, `delete`),
  `Paginated`, and the `Mapper` interface.
- **Repository base**: `TypeOrmRepositoryBase`, the port's four methods for a
  non-tenant TypeORM adapter (map, write through `writeWithEvents`, map back;
  `idColumn` for a table keyed by something other than `id`). Tenant-scoped
  adapters use `ScopedRepositoryBase` from `@oppenheimer/backend-authz`
  instead.
- **Guards & exceptions**: `Guard`, `ExceptionBase`, `NotFoundException`,
  `ConflictException`, `ArgumentInvalidException`, `ArgumentNotProvidedException`,
  `ArgumentOutOfRangeException`.
- **Transactional outbox**: `OutboxService` (`transaction(fn)` runs a
  multi-statement write and wakes the relay after commit when it staged
  anything; stage domain events / BullMQ jobs in the same transaction as the
  aggregate write; claim with
  `FOR UPDATE SKIP LOCKED`; retries with backoff and expiring leases, renewed
  by `extendLease` while a batch is delivered and fenced on the owner; a
  fire-and-forget `wake()`; `deleteProcessedBefore` for retention),
  `OutboxRelay` (a drain loop that runs one drain at a time and folds wakes
  into one more pass, + publisher contract), `OutboxMessageSchema`
  (decorator-free `EntitySchema` for the `outbox_message` table), and
  `TIMESTAMP_COLUMN_TYPE` — `timestamptz`, the type its dates and every date
  column of the API's ORM entities are stored as.
- **Utilities**: `RequestContextService`, `convertPropsToObject`.

## Usage

```ts
import { AggregateRoot, type RepositoryPort, Guard } from "@oppenheimer/backend-ddd";
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
```

## Consumed by

`apps/api`, `@oppenheimer/backend-core`.
