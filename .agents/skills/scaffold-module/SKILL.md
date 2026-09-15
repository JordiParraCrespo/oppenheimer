---
name: scaffold-module
description: Scaffold a new Domain-Driven Hexagon module in the Oppenheimer NestJS API (apps/api). Use when the user asks to create a new API module, feature, resource, or endpoint group in apps/api, or mentions adding a domain/aggregate to the backend. Generates a convention-compliant skeleton (domain, database/ports, commands, queries, mapper, DI tokens, module) that passes the dependency-cruiser architecture rules.
---

# Scaffold an API module (Domain-Driven Hexagon)

Generate a new vertical-slice module under `apps/api/src/<module>/` that follows
the architecture in `apps/api/ARCHITECTURE.md` and passes
`apps/api/.dependency-cruiser.cjs`. The `users` module is the reference — read it
when unsure.

## Before generating

Ask for / infer:

1. **Module name** (singular, e.g. `product`) and the **aggregate** name.
2. The **aggregate fields** and their types (which become `<Name>Props`).
3. The **use cases**: which are commands (writes) and which are queries (reads).
4. Whether a Zod schema for the entity already exists in `@oppenheimer/shared`
   (reuse it for request DTOs; do not duplicate types in the app).

## Layer rules (do not violate — the Stop hook + CI enforce these)

- `domain/` imports **only** `@oppenheimer/backend-ddd` and `@oppenheimer/shared`. No
  `@nestjs/*`, no `typeorm`, no `oxide.ts`.
- Handlers (`commands/`, `queries/`) inject the **repository port** via its DI
  token, never the concrete `*.repository.ts`.
- Only `database/` references the `*.orm-entity.ts`.
- No imports between sibling use-case slices — coordinate via the bus or events.

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
│   └── <module>.repository.ts         # @Injectable adapter: maps via mapper, publishes domain events after writes
├── commands/<use-case>/
│   ├── <use-case>.command.ts          # extends CommandBase
│   ├── <use-case>.service.ts          # @CommandHandler; returns AggregateID
│   ├── <use-case>.http.controller.ts  # dispatches via CommandBus; Swagger + guards + @Version('1')
│   └── <use-case>.request.dto.ts      # createZodDto(schemaFrom@oppenheimer/shared)
├── queries/<use-case>/
│   ├── <use-case>.query.ts            # extends QueryBase
│   ├── <use-case>.query-handler.ts    # @QueryHandler
│   └── <use-case>.http.controller.ts
├── application/event-handlers/        # @OnEvent handlers (optional)
├── dtos/<module>.response.dto.ts      # @ApiProperty fields; never expose sensitive data
├── <module>.mapper.ts                 # implements Mapper<Entity, OrmEntity, ResponseDto>
├── <module>.di-tokens.ts              # export const <MODULE>_REPOSITORY = Symbol('<MODULE>_REPOSITORY')
└── <module>.module.ts                 # CqrsModule + TypeOrmModule.forFeature([OrmEntity]); register handlers; bind { provide: <MODULE>_REPOSITORY, useClass: <Module>Repository }
```

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

Then register `<Module>Module` in `apps/api/src/app.module.ts`.

## After scaffolding

1. Fill in real domain logic and invariants (`validate()`).
2. If endpoints changed: `pnpm generate:api-client`.
3. Add a changeset: `pnpm changeset`.
4. Verify: `pnpm --filter @oppenheimer/api arch` and `pnpm --filter @oppenheimer/api lint`.
