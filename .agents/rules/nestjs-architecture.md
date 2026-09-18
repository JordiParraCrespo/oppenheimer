---
paths:
  - "apps/api/**/*"
  - "packages/backend/**/*"
---

# NestJS Architecture Rules

The API (`apps/api`) follows **Domain-Driven Hexagon** architecture. Dependencies
point inward: the domain depends on nothing, the application orchestrates the
domain, and infrastructure/interface adapters depend on the inside. The shared
building blocks live in `@oppenheimer/backend-ddd`.

## Module layout: one shape, enforced

Every module under `apps/api/src/` is cut the same way. A directory appears
only when it has something to hold — there are no placeholder layers — but the
set of directories is closed, and so is the set of file names each admits.

**That table lives in one place:
[`apps/api/ARCHITECTURE.md`](../../apps/api/ARCHITECTURE.md), and is executable
as `pnpm check:api-structure`.** Read it there rather than from a copy here —
a second copy is a second thing to update when the contract moves.

Two commands decide whether a module conforms, and they answer different
questions:

```bash
pnpm check:api-structure        # where a file may live, what it may be called
pnpm --filter @oppenheimer/api arch   # what it is then allowed to import
```

### There is no `services/`

A "service" is not a layer, and a directory named after one is where a module
goes to stop being a hexagon. When you are about to write one, ask which of
these it is:

| It…                                        | goes in                                        |
| ------------------------------------------ | ---------------------------------------------- |
| decides something from the domain alone     | `domain/<name>.policy.ts` / `.factory.ts`      |
| calls out of the process                    | `infrastructure/<name>.port.ts` + an adapter   |
| is what a route does                        | `commands/<use-case>/` or `queries/<use-case>/`|
| needs ports but no route reaches it         | `application/<name>.{factory,policy,resolver}.ts` |

The same applies to `entities/`, `utils/`, `helpers/`, `common/`, `types/`,
`interfaces/`, `constants/` and `models/`. `pnpm check:api-structure` names
each of them and the question to ask instead. The command handler is
`<use-case>.command-handler.ts` — there is no `.service.ts` either.

### What a handler may import

This is the part that is local to writing code, rather than to laying it out:

- `domain/` imports **only** `@oppenheimer/backend-ddd`, `@oppenheimer/backend-authz`,
  `@oppenheimer/shared` and node core. No `@nestjs/*`, no `typeorm`, no `oxide.ts`,
  no `express`.
- Handlers (`commands/`, `queries/`, `application/`) inject the **port** via
  its DI token — never a `*.repository.ts`, `*.adapter.ts` or `*.gateway.ts`.
- Only `database/` and `infrastructure/` name TypeORM; only `infrastructure/`
  (and the auth module's own guards) name Better Auth.
- A controller dispatches on the bus and maps; it never touches `database/` at
  runtime. It is capped at 110 lines, a handler at 120.
- Slices do not import each other's internals. Reusing another slice's
  `*.command.ts` / `*.query.ts` to dispatch is fine.
- A module publishes its `domain/`, `dtos/`, ports, DI tokens, bus messages and
  inbound adapters. Everything else is its own.

## CQRS command/query handlers

Use `@nestjs/cqrs`. Each use case is one handler — this is how
single-responsibility is enforced (no god-services).

- Commands extend `CommandBase`, queries extend `QueryBase` (both from `@oppenheimer/backend-ddd`).
- Controllers dispatch through `CommandBus` / `QueryBus`; they never call handlers directly.
- **Commands return only the aggregate id** (or nothing). To return a full DTO
  after a write, dispatch a follow-up query and map the result.
- Queries are read-only and may bypass the domain to read optimized models.
- Import `CqrsModule` in the feature module and register handlers as providers.

## Domain layer

- Aggregates extend `AggregateRoot`, entities extend `Entity`, value objects
  extend `ValueObject` (from `@oppenheimer/backend-ddd`). Invariants are enforced in
  `validate()` / value-object constructors — entities are always valid.
- Do **not** redeclare `_id` (or other base fields) in a subclass: under
  `useDefineForClassFields` a subclass field initializer resets the value the
  base constructor set. The base owns `_id`.
- State changes go through domain methods (e.g. `user.updateProfile(...)`),
  which raise domain events via `addEvent(...)`.
- No TypeORM, NestJS or HTTP imports in `domain/`.

## Repository ports & adapters

- Define a port interface in `database/<module>.repository.port.ts`, extending
  `RepositoryPort<Aggregate>` from `@oppenheimer/backend-ddd`. Lookups return
  `Option<T>` (from `oxide.ts`), not `T | null`.
- The TypeORM adapter implements the port, maps domain ↔ ORM via the mapper, and
  stages the aggregate's domain events on the **transactional outbox** inside
  the same transaction as the write (see "Event-driven async processing").
- Inject the port through a DI token (see `nestjs-di.md`), never the concrete class.

## Mapper

Use the `Mapper<DomainEntity, OrmEntity, ResponseDto>` interface from
`@oppenheimer/backend-ddd`:

- `toPersistence()` — domain entity → ORM record (only write columns the app owns)
- `toDomain()` — ORM record → domain entity
- `toResponse()` — domain entity → response DTO (never expose sensitive fields)

**Shape-to-shape translation belongs in the mapper, not in handlers.** Any
"copy these fields from representation A into representation B" logic — including
mapping an external adapter's normalized shape into domain input props (e.g. a
payment gateway's `NormalizedSubscription` → the aggregate's `SyncSubscriptionProps`)
— is a mapper method (`toSyncProps(...)`), injected into the handler. Handlers
orchestrate; they don't hand-assemble object literals field by field. A mapper
may add methods beyond the three interface ones for these cross-boundary shapes.

## Pluggable service pattern (backend packages)

Pluggable backend packages (`@oppenheimer/backend-email`, `-storage`, `-cache`,
`-queue`) follow this pattern:

1. **Abstract class** defines the interface (e.g. `EmailService`)
2. **Concrete implementations** provide behavior (e.g. `ConsoleEmailService`, `ResendEmailService`)
3. **`@Global` DynamicModule** with a factory reads config to select the active implementation

When adding a new pluggable service, follow this same pattern. Never hardcode a
specific implementation in consumer code. (Library packages like
`@oppenheimer/backend-core` and `@oppenheimer/backend-ddd` export building blocks instead —
see `backend-packages.md`.)

## Structured errors (RFC 7807)

Every error response is a **problem document** (`application/problem+json`,
[RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807)) produced by the
global `AllExceptionsFilter`. Use `AppError` from `@oppenheimer/backend-core` with an
error catalog per module in `domain/<module>.errors.ts`:

```typescript
import { AppError } from "@oppenheimer/backend-core";
import { UserErrors } from "../../domain/user.errors";

throw new AppError(UserErrors.NOT_FOUND, {
  detail: `No user with id ${id}`, // specific to THIS request
  extensions: { userId: id }, // extra members on the problem document
});
```

**Title vs detail.** The catalog `message` becomes the problem `title` and must
stay stable per error type — never interpolate request data into it
(`{...UserErrors.NOT_FOUND, message: \`…: ${id}\`}`is the anti-pattern this
replaced). Anything that varies per occurrence goes in`detail`, and anything a
client should act on programmatically goes in `extensions`.

Each catalog entry has a code (e.g. `USER_001`), message and HTTP status; the
code becomes both the `code` member and the problem `type` URI
(`https://oppenheimer.dev/errors#user_001`, base configurable via
`ERROR_TYPE_BASE_URL`). Domain exceptions from `@oppenheimer/backend-ddd` (e.g.
`ArgumentInvalidException`, `NotFoundException`) carry their own `httpStatus`
and surface through the same filter. Validation failures list every rejected
field in `invalidParams`. 5xx responses never echo the underlying message —
only a correlation id.

### Only `AppError` gets a code — never throw a bare Nest exception

`AllExceptionsFilter` reads a `code` from **`AppError` alone**. A bare
`HttpException` — including `new HttpException({ message, code }, status)` —
renders as a problem document with **no `code`** and `type: about:blank`, whose
`title` is only the status phrase ("Conflict", "Forbidden"). That is deliberate:
only curated catalog codes are part of the public contract. The consequence is
that `throw new ForbiddenException(...)` / `new NotFoundException(...)` in a
handler or guard silently leaves the catalog, and every client — CLI exit codes,
MCP tool errors, the web app's translated messages — loses the thing it branches
on.

```typescript
// WRONG — reaches the client as a bare 403 with no code
throw new ForbiddenException('No user found in request');

// WRONG — the `code` is dropped; the filter does not read it off the body
throw new HttpException({ message: 'Slug taken', code: 'SLUG_TAKEN' }, 409);

// CORRECT
throw new AppError(AuthErrors.FORBIDDEN);
```

A guard that returns `false` also yields Nest's own codeless 403 — throw the
catalog error instead of returning `false`.

The only sanctioned non-`AppError` throws are the `@oppenheimer/backend-ddd` domain
exceptions (`ArgumentInvalidException`, `NotFoundException`, …), which carry
their own `code`/`httpStatus` and are documented as `GENERIC.*`; framework
contracts a library owns (Terminus's `HealthCheckError`); and plain `Error` on
paths that never reach an HTTP response (the outbox relay, queue processors,
the standalone `packages/backend/*` services, which have no `@oppenheimer` deps by
design).

### Wrapping a third-party service

When a module delegates to something with its own error vocabulary — as the
organization and admin façades do with Better Auth — **do not pass the upstream
error through**. Fold its code onto a catalog entry with a mapper, and keep the
original as an `upstreamCode` extension member so debugging loses nothing:

```typescript
// organizations/organization-error.mapper.ts
export const invokeOrganizationApi = betterAuthInvoker(mapOrganizationError);
```

Group upstream codes by **what a client would do about them**, not one-to-one:
Better Auth has ~60 organization codes distinguished by the wording of an
English sentence. A mapper must be **total** — match the codes worth branching
on, then fall back on the HTTP status — so a code added by a future release
still produces a documented problem instead of an unhandled 500.

### Documenting failures

Document each failure on the controller so it reaches the OpenAPI document:

```typescript
@ApiProblemResponse({ status: 404, description: 'User not found', code: 'USER_001' })
```

The 401/403 every guarded route can produce are covered once at the **class**
level by `@ApiAuthProblemResponses()` from `@oppenheimer/backend-core` — apply that to
the controller rather than repeating two decorators on every method.

### A new code needs four things

A catalog entry alone is not enough. Adding one means:

1. the entry in `apps/api/src/<module>/domain/<module>.errors.ts`;
2. an `@ApiProblemResponse` on the endpoint that can raise it;
3. a row in `apps/docs/docs/errors.md` — the problem `type` URI is an anchor on
   that page, so an undocumented code points at a dead link;
4. a message under `errors.byCode.<CODE>` in **every** locale in
   `packages/translations`, or the apps fall back to a generic sentence.

## Event-driven async processing (transactional outbox)

Domain events are raised by aggregates and **staged on the transactional
outbox** (`outbox_message`) by the repository, via
`OutboxService.stageEvents(manager, events)` from `@oppenheimer/backend-ddd`, **inside
the same TypeORM transaction as the aggregate write**. The state change and the
events it owes commit or roll back together — `commit(); emit();` has no window
in which a listener crash, a Redis blip, or a killed process can silently lose
the side effect. The row *is* the message: `aggregateId` is a plain column with
no foreign key, so a queued event outlives the record it names.

After commit the repository wakes the relay (`OutboxRelayService` in
`apps/api/src/outbox/`); a background poll is the safety net for rows whose
process died between commit and delivery. The relay claims due rows with
`FOR UPDATE SKIP LOCKED` — concurrent API replicas lease disjoint rows, which is
what makes the pattern safe under horizontal scaling — and delivers them:

- `channel: 'event'` rows → re-emitted on `EventEmitter2`, keyed by event class
  name. Existing `@OnEvent` handlers are unchanged, but they receive the
  deserialized **payload** (a plain object with the event's fields), not the
  class instance.
- `channel: 'queue'` rows (staged with `OutboxService.stageJob`) → added to the
  BullMQ queue named by `topic`.

Delivery failures retry with exponential backoff and park as `failed` after
`maxAttempts` — kept for inspection, never dropped. Leases expire
(`lockedUntil`), so rows owned by a dead process are reclaimed rather than
stuck. Every row records a human-readable **reason** (pass `reason` when raising
the event) so the table is self-explaining at 2am.

This does **not** replace BullMQ: BullMQ still owns retries, delayed jobs and
concurrency for queued work. The outbox sits in front of it and solves exactly
one problem BullMQ cannot — atomicity with the database transaction. Work that
can be deferred (e.g. sending email) must still not block the request.

```
DeleteUserCommand → UserEntity.delete() raises UserDeletedDomainEvent (with reason)
  → repository stages it on the outbox in the same transaction as the delete
  → commit → relay delivers (wake now; poll as safety net)
  → @OnEvent handler → (Email Queue → Processor)
```

## Cross-cutting concerns

- DDD building blocks (entity/value-object/aggregate/event/command/query bases,
  ports, mapper interface, domain exceptions) live in `@oppenheimer/backend-ddd`
- Filters, interceptors, pipes, and shared interfaces go in `@oppenheimer/backend-core`, not in `apps/api`
- Email templates go in `packages/backend/email/src/templates/` as React components
- Shared types/schemas go in `packages/shared`, not duplicated in apps
