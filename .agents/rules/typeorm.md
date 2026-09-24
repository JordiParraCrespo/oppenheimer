---
paths:
  - "apps/api/**/*"
  - "packages/backend/**/*"
---

# TypeORM Rules

## Union-typed columns need explicit `type`

TypeScript's `emitDecoratorMetadata` reflects union types (e.g. `string | null`) as `Object`, which PostgreSQL doesn't support. Always add an explicit `type` to `@Column()` for union types.

```typescript
// WRONG — TypeORM sees "Object" and Postgres rejects it
@Column({ nullable: true })
resetPasswordToken!: string | null;

// CORRECT — explicit type resolves to varchar
@Column({ nullable: true, type: 'varchar' })
resetPasswordToken!: string | null;
```

A `Date | null` column is the same trap, and is declared through
`TimestampColumn` (below), which supplies the type.

Non-union types (`string`, `number`, `boolean`) reflect correctly and don't need an explicit `type`. A date, nullable or not, always goes through the decorators below.

## Points in time are `timestamptz`, through the shared decorators

Every date column is declared with a decorator from `@oppenheimer/backend-ddd`,
never with TypeORM's own or a hand-written `type`:

```typescript
import { CreatedAtColumn, TimestampColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';

@TimestampColumn({ nullable: true })
stoppedAt!: Date | null;

@CreatedAtColumn()
createdAt!: Date;

@UpdatedAtColumn()
updatedAt!: Date;
```

They fix the type to `timestamptz`. TypeORM's default for a date column is
`timestamp without time zone`, whose value goes out with no offset and is read
by the browser as local time, so every date was out by the reader's offset
(#61). `pnpm check:api-structure` fails an `*.orm-entity.ts` that uses
`CreateDateColumn`, `UpdateDateColumn`, `DeleteDateColumn` or spells a
timestamp type itself. A migration that adds a date column writes
`timestamptz`.

## Entity conventions

TypeORM entities are **persistence models**, not domain entities. Name them
`<module>.orm-entity.ts` and place them in the module's `database/` folder; the
domain `Entity`/`AggregateRoot` lives in `domain/` and is mapped to/from the ORM
record by the mapper (`toDomain` / `toPersistence`). See `nestjs-architecture.md`.

- Use `@PrimaryGeneratedColumn('uuid')` for IDs the app owns. Tables owned by
  Better Auth (e.g. `user`) use `@PrimaryColumn({ type: 'uuid' })` because Better
  Auth generates the id.
- Sensitive fields (password, refreshToken) must never appear on the response
  DTO — the mapper's `toResponse()` only copies safe fields
- When writing only the columns the app owns (e.g. profile fields on a Better
  Auth table), leave the rest unset in `toPersistence()` so `save()` doesn't
  clobber columns another system manages
