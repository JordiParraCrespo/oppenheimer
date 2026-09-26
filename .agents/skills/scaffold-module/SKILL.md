---
name: scaffold-module
description: Scaffold a new Domain-Driven Hexagon module in the Oppenheimer NestJS API (apps/api). Use when the user asks to create a new API module, feature, resource, or endpoint group in apps/api, or mentions adding a domain/aggregate to the backend. Generates a skeleton that satisfies the module contract (`pnpm check:api-structure`) and the dependency-cruiser boundary rules.
---

# Scaffold an API module (Domain-Driven Hexagon)

Generate a module under `apps/api/src/<module>/` that satisfies the **module
contract** in `apps/api/ARCHITECTURE.md`. Two checks hold it, and a scaffold
that does not pass both is not done:

```bash
pnpm check:api-structure          # where a file may live, what it may be called
pnpm --filter @oppenheimer/api arch     # what it is then allowed to import
```

`users/` is the reference module — read it when a shape is unclear. Do **not**
copy `organizations/` or `admin/`, which are mid-migration to this contract and
are ledgered as such.

## Before generating

Ask for / infer:

1. **Module name** and, if there is one, the **aggregate** name.
2. The **aggregate fields** and their types (which become `<Name>Props`).
3. The **use cases**: which are commands (writes) and which are queries (reads).
   One use case is one directory — name each after what it does, verb first.
4. Whether a Zod schema already exists in `@oppenheimer/shared` (reuse it for request
   DTOs; do not duplicate types in the app).
5. **Whether the app owns the data.** If the records live in an external system
   (Better Auth, Stripe, another service), there is no aggregate to write — see
   "A module that owns no aggregate" below. The contract still applies.

## The contract

**Do not work from a copy of it.** The closed set of layer directories and the
file names each admits live in `apps/api/ARCHITECTURE.md`, and
`pnpm check:api-structure` is that table executable. Read the page, generate,
then run both checks — they will name anything the skeleton got wrong, in the
words the contract uses.

Three things the generator gets wrong most often:

- **Never create an empty directory** to look complete. A directory appears
  when it has something to hold.
- **Never generate a `services/` directory, a root-level `*.service.ts`, or a
  `*.controller.ts` outside a slice.** When something feels like a service,
  decide what it is:

  | It…                                     | goes in                                           |
  | --------------------------------------- | ------------------------------------------------- |
  | decides from the domain alone            | `domain/<name>.policy.ts` / `.factory.ts`         |
  | calls out of the process                 | `infrastructure/<name>.port.ts` + an adapter      |
  | is what a route does                     | `commands/<use-case>/` or `queries/<use-case>/`   |
  | needs ports but no route reaches it      | `application/<name>.{factory,policy,resolver}.ts` |

- **Every file in a slice is named after the slice**, and the command handler
  is `<use-case>.command-handler.ts` — matching `<use-case>.query-handler.ts`.

## Layer rules (the Stop hook + CI enforce these)

- `domain/` imports **only** `@oppenheimer/backend-ddd`, `@oppenheimer/backend-authz` and
  `@oppenheimer/shared` plus node core. No `@nestjs/*`, no `typeorm`, no `oxide.ts`,
  no `express`.
- Handlers inject the **port** via its DI token — never a `*.repository.ts`,
  `*.adapter.ts` or `*.gateway.ts`. Every adapter you generate gets a
  `*.port.ts` and a token beside it; a class registered directly in the module
  is the mistake this contract exists to stop.
- Only `database/` references the `*.orm-entity.ts`, and only `database/` and
  `infrastructure/` name TypeORM.
- A controller dispatches on the bus and maps; it never touches `database/`.
- No imports between sibling slices — coordinate via the bus or events.
- Another module's internals are off limits: what it publishes is its
  `domain/`, `dtos/`, ports, DI tokens, bus messages and inbound adapters.
- **Caps:** a controller is 110 lines, a handler 120.

## Files to generate

```
<module>/
├── domain/
│   ├── <module>.entity.ts             # extends AggregateRoot<Props>; static create(); domain methods; validate()
│   ├── value-objects/                 # only if the aggregate needs them
│   ├── events/<event>.domain-event.ts # extends DomainEvent; raised via addEvent()
│   └── <module>.errors.ts             # AppError catalog: { code: '<MOD>_001', message, httpStatus }
├── database/
│   ├── <module>.orm-entity.ts         # @Entity TypeORM persistence model
│   ├── <module>.repository.port.ts    # extends RepositoryPort<Entity>; finds return Option<T>
│   └── <module>.repository.ts         # @Injectable adapter: maps via mapper, stages events on the outbox
├── commands/<use-case>/
│   ├── <use-case>.command.ts          # extends CommandBase
│   ├── <use-case>.command-handler.ts  # @CommandHandler; returns AggregateID
│   ├── <use-case>.http.controller.ts  # dispatches via CommandBus; Swagger + guards + @Version('1')
│   └── <use-case>.request.dto.ts      # createZodDto(schema from @oppenheimer/shared)
├── queries/<use-case>/
│   ├── <use-case>.query.ts            # extends QueryBase
│   ├── <use-case>.query-handler.ts    # @QueryHandler
│   └── <use-case>.http.controller.ts
├── application/event-handlers/        # @OnEvent handlers (only if there are any)
├── dtos/<module>.response.dto.ts      # @ApiProperty fields; never expose sensitive data
├── <module>.mapper.ts                 # implements Mapper<Entity, OrmEntity, ResponseDto>
├── <module>.di-tokens.ts              # export const <MODULE>_REPOSITORY = Symbol('<MODULE>_REPOSITORY')
└── <module>.module.ts                 # CqrsModule + TypeOrmModule.forFeature([OrmEntity]); register handlers; bind the port
```

Every file inside a slice is named after the slice: `commands/update-user/`
holds `update-user.command.ts`, not `command.ts`. A message and its handler
come as a pair. A slice with only a controller is one that dispatches another
slice's message — that is the only way to have a controller without a handler.

## A module that owns no aggregate

When an external system owns the records, skip `domain/` and `database/`
entirely — do **not** invent an aggregate that mirrors someone else's table,
and do not leave empty directories behind. Generate instead:

```
<module>/
├── infrastructure/
│   ├── <module>-gateway.port.ts       # what the application needs, in its own words
│   └── <external>-<module>.gateway.ts # @Injectable adapter implementing the port
├── commands/<use-case>/ …             # one slice per operation, as above
├── queries/<use-case>/ …
├── dtos/<module>.response.dto.ts
├── <module>.mapper.ts                 # normalizes the external shape into the DTO
├── <module>.di-tokens.ts              # <MODULE>_GATEWAY = Symbol('<MODULE>_GATEWAY')
└── <module>.module.ts                 # binds { provide: <MODULE>_GATEWAY, useClass: … }
```

Handlers inject the **port**, never the gateway. Not owning the data is a
reason to have a port, not a reason to skip the contract.

## Module wiring template

```typescript
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([<Module>OrmEntity])],
  controllers: [/* static routes (e.g. me) before parameterized (:id) */],
  providers: [
    ...commandHandlers, ...queryHandlers, ...eventHandlers,
    <Module>Mapper,
    { provide: <MODULE>_REPOSITORY, useClass: <Module>Repository },
  ],
  exports: [<MODULE>_REPOSITORY, TypeOrmModule],
})
export class <Module>Module {}
```

Then register `<Module>Module` in `apps/api/src/app.module.ts`, and register
any new ORM entity in `src/config/data-source.ts` and `src/database/seed.ts`
as well.

## After scaffolding

1. Fill in real domain logic and invariants (`validate()`).
2. Every route needs `@ApiOperation`/`@ApiResponse`/`@ApiTags`, `@Version('1')`,
   a `@CheckPolicies` (or `@NoPolicy('reason')`) and `@RequireScopes`.
3. A new error code needs its catalog entry, an `@ApiProblemResponse`, a row in
   `apps/docs/docs/errors.md` and a message in every locale.
4. If endpoints changed: `pnpm generate:api-client`.
5. Add a changeset: `pnpm changeset`.
6. Verify: `pnpm check:api-structure`, `pnpm --filter @oppenheimer/api arch`,
   `pnpm --filter @oppenheimer/api lint`, `pnpm --filter @oppenheimer/api test`.
