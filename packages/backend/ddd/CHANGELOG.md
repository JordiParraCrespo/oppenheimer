# @oppenheimer/backend-ddd

## 0.3.0

### Minor Changes

- f099524: Add transactional-outbox building blocks: `OutboxMessageSchema`, an `OutboxService` that stages inside the caller's transaction and leases claims with `FOR UPDATE SKIP LOCKED`, and `OutboxRelay`.
- f099524: Domain exceptions carry an `httpStatus`, so a `NotFoundException` surfaces as 404 rather than a blanket 500.
- a81af0d: `TIMESTAMP_COLUMN_TYPE` (`timestamptz`) is the type a date column is stored as; the outbox table's dates use it.

## 0.2.0

### Minor Changes

- aa0eefd: Refactor the API toward Domain-Driven Hexagon architecture.

  - Add `@oppenheimer/backend-ddd`, a building-blocks package with `Entity`,
    `AggregateRoot`, `ValueObject`, `DomainEvent`, `CommandBase`, `QueryBase`,
    the `RepositoryPort`/`Paginated` abstractions, a domain/persistence/response
    `Mapper` interface, domain exceptions and `Guard`.
  - Restructure the users module into vertical slices (`commands/`, `queries/`,
    `domain/`, `database/`, `dtos/`, `application/`) on top of `@nestjs/cqrs`,
    with a `UserEntity` aggregate, an `Email` value object, a
    `UserRepositoryPort` and its TypeORM adapter, and domain-event publishing.
  - Invert the `@oppenheimer/backend-ddd` ↔ `@oppenheimer/backend-core` layering: the
    framework-free `RequestContextService` and the `ErrorDefinition` contract now
    live in `@oppenheimer/backend-ddd` (re-exported from `@oppenheimer/backend-core` for
    backwards compatibility), so the domain layer depends on no infrastructure.
  - Document the architecture in `apps/api/ARCHITECTURE.md`, add a
    `/scaffold-module` skill, and enforce the layer boundaries with
    dependency-cruiser (`pnpm arch`, wired into CI and a Stop hook).
