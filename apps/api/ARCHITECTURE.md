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
        depends on ──►  @oppenheimer/backend-ddd, @oppenheimer/shared only (domain)
```

- **Domain** depends on nothing but `@oppenheimer/backend-ddd` and `@oppenheimer/shared`.
  No NestJS, no TypeORM, no `oxide.ts`.
- **Application** (handlers) depends on the domain and on **repository ports**,
  never on the concrete repository.
- **Infrastructure** (`database/`) implements the ports and maps domain ↔ ORM.
- **Interface adapters** (controllers) only translate HTTP ↔ command/query bus.

## Module anatomy

Modules are sliced **vertically** by use case, not horizontally by layer. The
`users` module is the reference implementation:

```
users/
├── commands/                         # state-changing use cases
│   └── update-user/
│       ├── update-user.command.ts        # extends CommandBase
│       ├── update-user.service.ts        # @CommandHandler (returns AggregateID)
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
├── application/event-handlers/       # @OnEvent domain-event handlers
│   └── user-deleted.domain-event-handler.ts
├── dtos/user.response.dto.ts         # response contract (@ApiProperty)
├── user.mapper.ts                    # toPersistence / toDomain / toResponse
├── user.di-tokens.ts                 # Symbol tokens (e.g. USER_REPOSITORY)
└── user.module.ts                    # wires CqrsModule + handlers + repo binding
```

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
| Command handler    | `<use-case>.service.ts`         |
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
8. `pnpm --filter @oppenheimer/api arch` must pass.

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

## What is intentionally NOT full DDD

- **`auth/`** — authentication is owned by Better Auth. The app has no auth
  domain logic, so the module keeps Better Auth config, guards and decorators
  rather than a domain layer.
- **`health/`, `queue/`** — pure infrastructure, no domain.

The architecture rules are opt-in by folder (`domain/`, `commands/`, …), so these
infrastructure modules are not falsely flagged.

## Enforcement

- **`.dependency-cruiser.cjs`** encodes the boundaries (domain purity, no
  outward domain imports, handlers use ports not adapters, no cross-slice
  imports, ORM model stays in `database/`). Run `pnpm --filter @oppenheimer/api arch`.
- **CI** runs `pnpm arch` in the lint job — a violating PR fails.
- **Claude Code Stop hook** (`.agents/hooks/arch-check.sh`) runs the same check
  when a task touches `apps/api/src`, so violations are caught in-loop.
- **`.agents/rules/`** surface the conventions to the agent while editing.
