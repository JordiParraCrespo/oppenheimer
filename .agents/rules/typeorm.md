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

A `Date` column, nullable or not, is covered by the next section.

Non-union types (`string`, `number`, `boolean`) reflect correctly and don't need an explicit `type`.

## Points in time are `timestamptz`

Every date column names `TIMESTAMP_COLUMN_TYPE` from `@oppenheimer/backend-ddd`
as its `type`, on TypeORM's own decorators:

```typescript
import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';

@Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
stoppedAt!: Date | null;

@CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
createdAt!: Date;

@UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
updatedAt!: Date;
```

Left to itself TypeORM picks `timestamp without time zone`, for its date
decorators and for a plain `@Column` on a `Date` field alike. That value goes
out with no offset and the browser reads it as local time, so every date was
out by the reader's offset (#61). `pnpm check:api-structure` fails an
`*.orm-entity.ts` with a date column that does not name the constant, or that
spells a timestamp type as a string. A tombstone such as `deletedAt` is a plain
`@Column` like any other date; TypeORM soft-delete is not used. A migration that
adds a date column writes `timestamptz`.

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
