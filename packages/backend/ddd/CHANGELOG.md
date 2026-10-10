# @oppenheimer/backend-ddd

## 0.3.0

### Minor Changes

- affe343: Fix the building blocks: a command with an empty payload is accepted; an entity refuses an empty id, exposes `domainEvents` read-only and `setUpdatedAt()` defaults to now; `Guard.isEmpty` treats a whitespace-only string as empty and `lengthIsBetween` answers `false` for an empty value instead of throwing; `convertPropsToObject` walks the props instead of `structuredClone`-ing them, so nested value objects are unpacked and dates stay dates; exceptions are named after their class, export `GenericErrorCode`, and serialize `httpStatus` and only the name and message of their cause; `RequestContextService.run` returns the function's result.
- 22e89e4: Add `TypeOrmRepositoryBase.saveIf(entity, condition)`, a conditional write for an aggregate that is `PersistenceTracked`: one `UPDATE` on the manager of an `OutboxService.transaction`, whatever the aggregate owes. Only when it affected exactly one row are the aggregate's events staged (and the relay woken after commit), then cleared, and its `markPersisted()` called; a lost race stages nothing, wakes nothing and leaves the events. It answers whether the write won.
- fad86a0: The outbox relay publishes a claimed batch concurrently and marks it once every row settles, reading what went out from the settled results. `markProcessed` returns the ids it marked (the same shape as `extendLease`), and the relay counts only those, so a row whose lease was lost mid-delivery is not counted as delivered. `stageJob` takes `correlationId: string | null` from its caller (a command's or an event's `metadata.correlationId`, `null` for a sweep) and no longer reads the request context. `OutboxService.backlog()` reads the pending count, the failed count and the oldest pending `createdAt` in one statement, and `OutboxMessageSchema` declares the partial index `IDX_outbox_message_failed` that serves its failed count. A command's `metadata` may be passed in part (`{ correlationId }`), as a domain event's already could.
- 5a88302: Slim `RepositoryPort`, share the non-tenant TypeORM write path, and move
  "wake after commit" into `OutboxService.transaction`.

  - `@oppenheimer/backend-ddd`: `RepositoryPort` declares only `insert`, `save`,
    `findOneById` and `delete`. `findAll`, `findAllPaginated` and `transaction`
    are gone: nothing called `transaction`, and every implementation dropped the
    `EntityManager`, so writes made inside it never joined the transaction. A
    port that needs a list declares it. New `OutboxService.transaction(work)`
    runs `work` in one transaction and wakes the relay after commit when
    `stageEvents` (with at least one event) or `stageJob` ran on its manager;
    never after a rollback, never when nothing was staged. `writeWithEvents` is
    built on it. New `TypeOrmRepositoryBase<Aggregate, Orm>`: the port's four
    methods for a non-tenant adapter (map, write through `writeWithEvents`, map
    back), with `idColumn` for a table keyed by something other than `id`.
  - `@oppenheimer/api`: the user, feature-flag, flag-segment and user-settings
    adapters extend `TypeOrmRepositoryBase`; roles and API tokens lose their dead
    `findAll` / `findAllPaginated` / `transaction`. Every repository that staged
    outbox rows in its own transaction (projects, inbound events, automations,
    automation runs, hosts, host metadata, sessions, the personal workspace) now
    opens it with `outbox.transaction` and keeps no `staged` flag or `wake()`
    call of its own.

- f099524: Add transactional-outbox building blocks: `OutboxMessageSchema`, an `OutboxService` that stages inside the caller's transaction and leases claims with `FOR UPDATE SKIP LOCKED`, and `OutboxRelay`.
- 249b51b: The outbox relay renews its lease while it delivers a batch. A listener slower
  than the lease (30 s by default) could be claimed and run a second time by
  another replica's poll; now a heartbeat (`OutboxService.extendLease`, every
  third of the lease) keeps the rows, fenced on the relay's owner. The marks that
  end a delivery are fenced too: `markProcessed(ids, owner)` only marks rows that
  owner still leases, and `markFailed` only touches the claim it came from, so a
  relay that lost its lease anyway never finishes or releases another relay's
  claim. `OutboxRelayOptions.heartbeatMs` sets the renewal interval.

  Removed the unused `PaginatedQueryParams` and `OrderBy` types from the package's
  exports; nothing in the workspace read them since list queries moved onto the
  ports that need them.

- 1c2ae71: The outbox no longer puts delivery on the request path, and no longer grows
  for ever.

  - `OutboxService.wake()` returns `void` and does not wait for the drain it
    asks for. Before, `await wake()` resolved only after every drain queued
    ahead of it and a drain of every due row, listeners included, had finished,
    so a webhook accept or a runner `events.append` waited on the global
    backlog. Call it without `await`; an `await` on it still compiles and does
    nothing. Nothing tells a caller when its listeners have run.
  - `OutboxRelay.requestDrain()` runs at most one drain at a time; requests
    that land during it collapse into one more pass, instead of an unbounded
    chain of passes. `drainOnce()` still waits for the drain.
  - The relay marks a batch processed in one statement. A process that dies
    between publishing and that statement redelivers up to `batchSize` rows,
    which at-least-once delivery already allowed.
  - New `OutboxService.deleteProcessedBefore(cutoff, batch)`: the batched
    retention delete of `processed` rows. The API runs it daily
    (`QUEUE_NAMES.OUTBOX_RETENTION`, 7 days); `pending` and `failed` rows are
    kept.
  - `OutboxMessageSchema` declares `IDX_outbox_message_pending` (partial,
    `("createdAt") WHERE status = 'pending'`) and `IDX_outbox_message_created_brin`
    in place of `IDX_outbox_message_status_available`, mirroring the API's
    schema.

- f099524: Domain exceptions carry an `httpStatus`, so a `NotFoundException` surfaces as 404 rather than a blanket 500.
- a81af0d: `TIMESTAMP_COLUMN_TYPE` (`timestamptz`) is the type a date column is stored as; the outbox table's dates use it.

### Patch Changes

- 3de723c: Open the request's correlation id in middleware, so a guard's refusal carries it.

  - Removed: `RequestContextInterceptor`. Guards run before interceptors, so a
    401, 403 or 429 a guard threw went out with no `correlationId`.
  - Added: `RequestContextMiddleware`, which the API applies to every route in
    `AppModule.configure`, and `resolveCorrelationId` / `isValidCorrelationId` /
    `CORRELATION_HEADER`. An inbound `x-correlation-id` is honoured only when it
    is 1–64 characters of `[A-Za-z0-9._:-]` (the first value of a repeated
    header); anything else becomes a fresh UUID.
  - `buildPinoHttpOptions` sets `genReqId`, so the request log's `req.id` is the
    correlation id (no longer pino's counter), and every response, including the
    Better Auth routes, echoes it as `x-correlation-id`.

- c3c7883: `OutboxRelay.drainOnce()` recognises a call from inside a delivery with a flag
  that is true only while the publisher's promise is pending, instead of
  `AsyncLocalStorage`, whose context also followed a handler's detached work
  after the delivery had ended.
- 2d00e7e: The outbox relay no longer deadlocks when a delivery wakes it. An event handler
  that dispatches a command whose repository stages a row and calls `wake()` ran
  inside the drain it then waited on; every later wake queued behind the pair.
  A wake from inside a delivery now queues its pass and returns at once.

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
