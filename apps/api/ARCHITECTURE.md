# API Architecture — Domain-Driven Hexagon

`apps/api` follows **Domain-Driven Design + Hexagonal (Ports & Adapters)**,
adapted from [Sairyss/domain-driven-hexagon](https://github.com/Sairyss/domain-driven-hexagon).

This document is the source of truth. The machine-checked rules in
`.dependency-cruiser.cjs` and the scoped agent rules in `.agents/rules/` enforce
what is described here. When they disagree, fix the code or update both together.

## The one rule that matters

**Dependencies point inward.** Inner layers never import outer layers.

```
        ┌───────────────────────────────────────────────┐
        │  Interface adapters   commands|queries (*.http.controller, dtos)
        │  ┌─────────────────────────────────────────┐  │
        │  │  Application   command/query handlers     │  │
        │  │  ┌───────────────────────────────────┐    │  │
        │  │  │  Domain   entities, value objects, │   │  │
        │  │  │  domain events, errors (PURE)      │   │  │
        │  │  └───────────────────────────────────┘    │  │
        │  └─────────────────────────────────────────┘  │
        │  Infrastructure   database (orm-entity, repository, ports)
        └───────────────────────────────────────────────┘
        depends on ──►  @oppenheimer/backend-ddd, -authz, @oppenheimer/shared only (domain)
```

- **Domain** depends on nothing but `@oppenheimer/backend-ddd`,
  `@oppenheimer/backend-authz`, `@oppenheimer/shared` and node core. No NestJS, no
  TypeORM, no `oxide.ts`, no `express`. (`backend-authz` is in that list
  because the resource declaration a module's domain owns is written against
  it; `domain-stays-pure` in `.dependency-cruiser.cjs` is the enforced
  statement of this sentence.)
- **Application** (handlers) depends on the domain and on **repository ports**,
  never on the concrete repository.
- **Infrastructure** (`database/`) implements the ports and maps domain ↔ ORM.
- **Interface adapters** (controllers) only translate HTTP ↔ command/query bus.

## The module contract

Every directory under `src/` is a module, and every module is cut the same way.
There is **one shape**, and nothing in it is optional in the sense of "you may
put this elsewhere" — only in the sense that **a directory appears when it has
something to hold**. There are no placeholder directories: a module with no
aggregate has no `domain/`, and that is a statement about the module, not a gap.

What a module's root may carry, and nothing else:

| File                     | What it is                                     |
| ------------------------ | ---------------------------------------------- |
| `<module>.module.ts`     | the NestJS module — exactly one, and required   |
| `*.mapper.ts`            | one mapper per aggregate, named after it        |
| `*.di-tokens.ts`         | the `Symbol` tokens its ports are bound to      |
| `*.resource.ts`          | the CASL resource it owns                       |

Everything else lives in a layer directory whose name says which layer it is,
holding only the file names that layer admits:

| Directory                     | Holds                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `domain/`                     | `*.entity.ts`, `*.errors.ts`, `*.policy.ts`, `*.factory.ts`, `*.types.ts`, and `value-objects/*.value-object.ts`, `events/*.domain-event.ts` |
| `database/`                   | `*.orm-entity.ts`, `*.repository.port.ts`, `*.repository.ts`                               |
| `infrastructure/`             | `*.port.ts`, `*.adapter.ts`, `*.gateway.ts`, `*.processor.ts`, `*.config.ts`, `*.util.ts`, `*.types.ts` |
| `commands/<use-case>/`        | `<use-case>.command.ts`, `.command-handler.ts`, `.http.controller.ts`, `.request.dto.ts`   |
| `queries/<use-case>/`         | `<use-case>.query.ts`, `.query-handler.ts`, `.http.controller.ts`, `.request.dto.ts`       |
| `application/`                | `*.factory.ts`, `*.policy.ts`, `*.resolver.ts`, `*.port.ts`, and `event-handlers/*.domain-event-handler.ts` |
| `dtos/`                       | `*.response.dto.ts`                                                                        |
| `guards/`                     | `*.guard.ts`                                                                               |
| `decorators/`                 | `*.decorator.ts`                                                                           |
| `interceptors/`               | `*.interceptor.ts`                                                                         |
| `probes/`                     | `*.probe.controller.ts`, `*.indicator.ts`                                                  |
| `__tests__/`                  | `*.spec.ts` — and each layer may have its own                                              |

Four rules follow from the table and are worth stating on their own, because
they are the ones that decay first:

1. **There is no `services/`.** A "service" is not a layer, and a directory
   named after one is where a module goes to stop being a hexagon. Pure rules
   are `domain/*.policy.ts` or `*.factory.ts`. Something that calls out of the
   process is a port plus an adapter. Something a route reaches is a use case.
   Work that needs ports but is not a use case — building an ability, asserting
   a grant is permitted, resolving which organization a request acts in — is
   `application/`. The same goes for `entities/`, `utils/`, `common/`,
   `types/`, `interfaces/` and every other bucket named after nothing.
2. **A use case is a directory, and every file in it carries its name.**
   `commands/update-user/` holds `update-user.command.ts` and
   `update-user.service.ts`, not `command.ts` and `handler.ts`. A message and
   its handler come as a pair. A slice with only a controller is one that
   dispatches another slice's message — legitimate, and the only way to have a
   controller without a handler beside it.
3. **An HTTP route is declared in a use-case controller.** Nowhere else. A
   `@Get` outside `commands/<use-case>/` or `queries/<use-case>/` is a route
   with no use case behind it.
4. **A probe is not a use case.** `/health` and `/ready` report on the process
   itself: there is no command or query behind them and never will be, so they
   live in `probes/` rather than owing a slice they would leave empty.
5. **Caps.** A controller is 110 lines, a handler 120. They are not style
   preferences: past them, a controller has started deciding things and a
   handler has started doing them.

`pnpm check:api-structure` is this table, executable.

## Module anatomy

The `users` module is the reference implementation:

```
users/
├── commands/                         # state-changing use cases
│   └── update-user/
│       ├── update-user.command.ts        # extends CommandBase
│       ├── update-user.command-handler.ts # @CommandHandler (returns AggregateID)
│       ├── update-user.http.controller.ts
│       └── update-user.request.dto.ts    # Zod DTO via createZodDto
├── queries/                          # read-only use cases
│   └── find-users/
│       ├── find-users.query.ts           # extends QueryBase
│       ├── find-users.query-handler.ts   # @QueryHandler
│       ├── find-users.http.controller.ts
│       └── find-users.request.dto.ts
├── domain/                           # PURE — no framework/persistence imports
│   ├── user.entity.ts                    # AggregateRoot
│   ├── value-objects/email.value-object.ts
│   ├── events/user-deleted.domain-event.ts
│   └── user.errors.ts
├── database/                         # infrastructure (the adapters)
│   ├── user.orm-entity.ts                # TypeORM persistence model
│   ├── user.repository.port.ts           # the PORT (interface)
│   └── user.repository.ts                # TypeORM adapter implements the port
├── application/                      # needs ports, is not a use case
│   ├── user-access.policy.ts             # row-level authorization
│   └── event-handlers/
│       └── user-deleted.domain-event-handler.ts
├── dtos/user.response.dto.ts         # response contract (@ApiProperty)
├── user.mapper.ts                    # toPersistence / toDomain / toResponse
├── user.di-tokens.ts                 # Symbol tokens (e.g. USER_REPOSITORY)
└── user.module.ts                    # wires CqrsModule + handlers + repo binding
```

Modules are sliced **vertically** by use case, not horizontally by layer.

## Building blocks

All base classes come from `@oppenheimer/backend-ddd`.

### Domain entity / aggregate (`domain/*.entity.ts`)

Extends `AggregateRoot`/`Entity`. Always valid: invariants live in `validate()`.
State changes go through methods that may raise domain events. No `@nestjs/*`,
no `typeorm`.

```typescript
export class UserEntity extends AggregateRoot<UserProps> {
  static create(create: CreateEntityProps<UserProps>): UserEntity {
    return new UserEntity(create);
  }
  updateProfile(props: UpdateUserProps): void {
    if (props.firstName !== undefined) this.props.firstName = props.firstName;
    this.setUpdatedAt(new Date());
    this.validate();
  }
  delete(): void {
    this.addEvent(
      new UserDeletedDomainEvent({ aggregateId: this.id, email: this.email }),
    );
  }
  public validate(): void {
    if (!this.props.firstName)
      throw new ArgumentNotProvidedException("firstName cannot be empty");
  }
}
```

> ⚠️ Never redeclare `_id` (or other base fields) in a subclass — under
> `useDefineForClassFields` a subclass field initializer resets what the base
> constructor set. The base owns `_id`.

### Value object (`domain/value-objects/*.value-object.ts`)

Extends `ValueObject`, immutable, structural equality, validated in `validate()`.

### Domain event (`domain/events/*.domain-event.ts`)

Extends `DomainEvent`. Raised by the aggregate via `addEvent` (with a
human-readable `reason` for the outbox row), **staged on the transactional
outbox by the repository inside the same transaction as the write**, then
cleared after commit. The outbox relay delivers the row to `EventEmitter2`
(keyed by class name) after commit — immediately via a post-commit wake, with a
background poll reclaiming rows whose process died first. See
`.claude/rules/nestjs-architecture.md` ("Event-driven async processing").

### Repository port + adapter (`database/`)

The port extends `RepositoryPort<Aggregate>`; lookups return `Option<T>` from
`oxide.ts`, not `T | null`.

```typescript
// user.repository.port.ts
export interface UserRepositoryPort extends RepositoryPort<UserEntity> {
  findOneByEmail(email: string): Promise<Option<UserEntity>>;
  findUsers(params: FindUsersParams): Promise<Paginated<UserEntity>>;
}
```

The adapter (`user.repository.ts`) is the **only** place that touches both the
ORM entity and the domain entity. It maps via the mapper and stages the
aggregate's domain events on the outbox, atomically with the write.

### Command + handler (`commands/<use-case>/`)

```typescript
export class UpdateUserCommand extends CommandBase {
  readonly userId: string;
  // ...
  constructor(props: CommandProps<UpdateUserCommand>) {
    super(props); /* assign */
  }
}

@CommandHandler(UpdateUserCommand)
export class UpdateUserService implements ICommandHandler<
  UpdateUserCommand,
  AggregateID
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepositoryPort,
  ) {}
  async execute(command: UpdateUserCommand): Promise<AggregateID> {
    const found = await this.repo.findOneById(command.userId);
    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);
    const user = found.unwrap();
    user.updateProfile({ ...command });
    await this.repo.save(user);
    return user.id; // commands return only the id
  }
}
```

### Query + handler (`queries/<use-case>/`)

Same shape with `QueryBase` / `@QueryHandler`. Queries are read-only and return
data for the controller to map.

### Controller (`*.http.controller.ts`)

One controller per use case. **No business logic** — it dispatches through
`CommandBus`/`QueryBus` and maps the result. After a write it dispatches a query
to return the full DTO. Needs `@ApiTags`/`@ApiOperation`/`@ApiResponse`,
`@Version('1')`, and the auth guards/policies. Multiple controllers share
`@Controller('users')`; register static routes (`me`) before `:id` in the module.

### Mapper (`*.mapper.ts`)

Implements `Mapper<DomainEntity, OrmEntity, ResponseDto>`:
`toPersistence` (write only app-owned columns), `toDomain`, `toResponse` (never
leak sensitive fields). Field-by-field translation between representations lives
here, not in handlers — including mapping an adapter's normalized shape into
domain input props (e.g. a gateway's `NormalizedSubscription` →
`SyncSubscriptionProps` via `toSyncProps`). A mapper may add methods beyond the
three interface ones for these cross-boundary shapes.

## Request flow

```
Write:  HTTP → Controller → new Command → CommandBus → Handler
        → load aggregate (port) → domain method → repo.save → returns id
        → Controller dispatches Query → maps → ResponseDto
        (repo stages domain events on the outbox in the same transaction
         → relay delivers after commit → @OnEvent handler → side effects)

Read:   HTTP → Controller → new Query → QueryBus → QueryHandler
        → port read → mapper.toResponse → ResponseDto
```

## Naming conventions

| Artifact           | File                            |
| ------------------ | ------------------------------- |
| Command            | `<use-case>.command.ts`         |
| Command handler    | `<use-case>.command-handler.ts` |
| Query              | `<use-case>.query.ts`           |
| Query handler      | `<use-case>.query-handler.ts`   |
| HTTP controller    | `<use-case>.http.controller.ts` |
| Request DTO        | `<use-case>.request.dto.ts`     |
| Aggregate/entity   | `<name>.entity.ts`              |
| Value object       | `<name>.value-object.ts`        |
| Domain event       | `<name>.domain-event.ts`        |
| Domain errors      | `<module>.errors.ts`            |
| ORM model          | `<module>.orm-entity.ts`        |
| Repository port    | `<module>.repository.port.ts`   |
| Repository adapter | `<module>.repository.ts`        |
| Response DTO       | `<module>.response.dto.ts`      |
| Mapper             | `<module>.mapper.ts`            |
| DI tokens          | `<module>.di-tokens.ts`         |
| Domain policy/rule | `<name>.policy.ts`              |
| Domain factory     | `<name>.factory.ts`             |
| Non-database port  | `<name>.port.ts`                |
| Adapter for a port | `<name>.adapter.ts`             |
| Adapter for a SaaS | `<name>.gateway.ts`             |
| Queue worker       | `<name>.processor.ts`           |
| Application resolver | `<name>.resolver.ts`          |

## Adding a new module

Run the `/scaffold-module` skill to generate a compliant skeleton, then fill in
the domain. Manual checklist:

1. `domain/` — aggregate (+ value objects), events, `errors.ts`. Keep it pure.
2. `database/` — `*.orm-entity.ts`, `*.repository.port.ts` (extends
   `RepositoryPort`), `*.repository.ts` (implements port, maps, stages events
   on the outbox).
3. One folder per use case under `commands/` and `queries/`.
4. `*.mapper.ts`, `*.di-tokens.ts`, `dtos/*.response.dto.ts`.
5. `*.module.ts` — import `CqrsModule` + `TypeOrmModule.forFeature([OrmEntity])`,
   register handlers, bind `{ provide: X_REPOSITORY, useClass: XRepository }`.
6. Reuse Zod schemas from `@oppenheimer/shared` for request DTOs.
7. After endpoint changes: `pnpm generate:api-client`. Add a changeset.
8. `pnpm check:api-structure` and `pnpm --filter @oppenheimer/api arch` must pass.

A module whose records live in an external system skips steps 1 and 2: there is
no aggregate to write and no table to map. It still gets a port
(`infrastructure/<module>-gateway.port.ts`), a gateway that implements it, and
one slice per operation — and no empty `domain/` left behind.

## Authorization (roles & permissions)

Authorization is **database-backed dynamic RBAC** — see `.agents/rules/rbac-roles.md`
for the working guide. Key points relevant to the architecture:

- The **`roles/` module** is a normal DDD-Hexagon slice (`RoleEntity` aggregate
  owning `Permission` value objects stored as `jsonb`, plus a `user_role` join
  for multiple-roles-per-user). It is the reference for a module that also owns a
  link table and a domain service.
- It is declared `@Global` so its **`AbilityFactory`** (consumed by the `auth`
  `PoliciesGuard` from every feature module) and repository ports are available
  app-wide without circular module imports.
- Permissions live in `@oppenheimer/shared` (`defineAbilitiesFromPermissions`,
  `PermissionDefinition`). Controllers stay thin: `@UseGuards(AuthGuard,
PoliciesGuard)` + `@CheckPolicies({ action, subject })`. Instance-level
  (resource-scoped) checks use the ability the guard attaches to
  `request.ability`.

## Modules that own no aggregate

Some modules have no domain of their own. `auth/` is Better Auth's; `health/`,
`queue/`, `outbox/`, `throttling/` and `capabilities/` are infrastructure.

This does **not** buy them a different shape. They are held to the same
contract, and the contract accommodates them by the same means it accommodates
everything: a directory appears when it has something to hold. A module with no
aggregate has no `domain/` — not an empty one, and not a `UserOrmEntity`
dressed up as an aggregate to satisfy a checker. What it *does* have still has
to be named for the layer it is in: Better Auth's configured instance is
`auth/infrastructure/better-auth.config.ts`, the BullMQ worker is
`queue/infrastructure/email.processor.ts`, the throttler's Redis store is
`throttling/infrastructure/redis-throttler.adapter.ts`.

The same applies to a module that wraps an external system it does not own.
Better Auth owns the organization and admin tables, so there is no aggregate to
write — but there is a **port** describing what the application needs from it,
a **gateway** in `infrastructure/` that speaks to it, and a use-case slice per
operation. "We don't own the data" is a reason to have a port, not a reason to
have a 500-line service.

## Enforcement

Two checks, and they answer different questions. The structure check says
**where a file may live and what it may be called**; the dependency check says
**what it is then allowed to know about**. Neither subsumes the other: a file
in the right directory can still import the wrong thing, and a correct import
graph can still be unnavigable.

- **`scripts/check-api-structure.mjs`** is the module contract above, executable
  — the closed directory set, the file names each admits, use-case slice
  completeness, the dissolved buckets, the route rule and the line caps. Run
  `pnpm check:api-structure`.
- **`.dependency-cruiser.cjs`** encodes the boundaries (domain purity, no
  outward domain imports, handlers use ports not adapters, controllers go
  through the bus, TypeORM and Better Auth stay behind adapters, no cross-slice
  and no cross-module internals). Run `pnpm --filter @oppenheimer/api arch`.
- **Ledger entries.** Where a dependency rule carries a `pathNot` naming
  specific files, those are known violations awaiting a refactor, not
  exemptions. The comment beside each says what it is waiting for. Adding a
  name to one of those lists deserves the same scrutiny as deleting the rule.
- **CI** runs both in the lint job — a violating PR fails.
- **Claude Code Stop hook** (`.agents/hooks/arch-check.sh`) runs the same check
  when a task touches `apps/api/src`, so violations are caught in-loop.
- **`.agents/rules/`** surface the conventions to the agent while editing.
