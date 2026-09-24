# @oppenheimer/backend-ddd

Domain-Driven Hexagon building blocks for the API. Framework-agnostic — it has
**no NestJS dependency** — so the domain layer stays pure. (TypeORM is a
dependency only for the outbox building blocks and the date-column
decorators; the domain bases don't touch it.) `Result`-based error
handling comes from [`oxide.ts`](https://github.com/traverse1984/oxide.ts).

See [`apps/api/ARCHITECTURE.md`](../../../apps/api/ARCHITECTURE.md) for how these
pieces fit the layer model, and `.agents/rules/nestjs-architecture.md` for usage
rules.

## What's inside

- **Tactical patterns**: `Entity`, `AggregateRoot`, `ValueObject`, and their
  prop/ID types (`AggregateID`, `BaseEntityProps`, `CreateEntityProps`,
  `DomainPrimitive`, `Primitives`).
- **CQRS bases**: `CommandBase`, `QueryBase`, `DomainEvent` (+ their metadata/props types).
- **Ports**: `RepositoryPort`, `Paginated`, `PaginatedQueryParams`, `OrderBy`,
  and the `Mapper` interface.
- **Guards & exceptions**: `Guard`, `ExceptionBase`, `NotFoundException`,
  `ConflictException`, `ArgumentInvalidException`, `ArgumentNotProvidedException`,
  `ArgumentOutOfRangeException`.
- **Transactional outbox**: `OutboxService` (stage domain events / BullMQ jobs
  in the same transaction as the aggregate write; claim with
  `FOR UPDATE SKIP LOCKED`; retries with backoff and expiring leases),
  `OutboxRelay` (drain loop + publisher contract), `OutboxMessageSchema`
  (decorator-free `EntitySchema` for the `outbox_message` table).
- **Date columns**: `TimestampColumn`, `CreatedAtColumn`, `UpdatedAtColumn`
  and `TIMESTAMP_COLUMN_TYPE`. Every date column in the API is declared through
  them, so it is stored as `timestamptz`; TypeORM's default, `timestamp without
  time zone`, reaches the browser as local time. `pnpm check:api-structure`
  holds the API's ORM entities to it.
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
