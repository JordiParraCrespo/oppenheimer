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
out by the reader's offset (#61). A tombstone such as `deletedAt` is a plain
`@Column` like any other date; TypeORM soft-delete is not used. A migration
that adds a date column writes `timestamptz`. What holds the rule is
`apps/api/src/__tests__/schema.integration.spec.ts`: it fails if any table the
migrations build has a `timestamp without time zone` column.

## Entity conventions

TypeORM entities are **persistence models**, not domain entities. Name them
`<module>.orm-entity.ts` and place them in the module's `database/` folder; the
domain `Entity`/`AggregateRoot` lives in `domain/` and is mapped to/from the ORM
record by the mapper (`toDomain` / `toPersistence`). See `nestjs-architecture.md`.

How a table is designed (keys, types, indexes, constraints, migrations) is
`database-design.md`.

- Use `@PrimaryGeneratedColumn('uuid')` for IDs the app owns. Tables owned by
  Better Auth (e.g. `user`) use `@PrimaryColumn({ type: 'uuid' })` because Better
  Auth generates the id.
- Sensitive fields (password, refreshToken) must never appear on the response
  DTO — the mapper's `toResponse()` only copies safe fields
- When writing only the columns the app owns (e.g. profile fields on a Better
  Auth table), leave the rest unset in `toPersistence()` so `save()` doesn't
  clobber columns another system manages

## A racing state transition is a conditional `UPDATE`, not a `save`

`Repository.save` is an upsert keyed on the primary key: it writes whatever
the instance holds, whatever the row holds now. When two writers can make the
same transition, write it as `update({ id, status: statusAtLoad }, changes)`
and read `result.affected === 1` as "this write won"; on `0`, stage nothing
and abandon. `TypeOrmRepositoryBase.saveIf` does exactly this (and stages the
events only on a win). The rule and its reasons are in `nestjs-architecture.md`
("A transition two writers can race is a conditional write"). The mapper's
record minus its id is the `SET` list, so a column `toPersistence()` leaves
unset is left alone, the same as for `save`.

## `manager.query` does not answer an `UPDATE` the way it answers a `SELECT`

`PostgresQueryRunner.query` switches on the command postgres reports: a
`SELECT` (and an `INSERT`, including `ON CONFLICT`) comes back as the rows,
but an **`UPDATE` or `DELETE` comes back as `[rows, affected]`**. So a
`RETURNING` clause on those two is read one level down:

```ts
// WRONG — `due` is `[rows, affected]`, so this loops twice, over an array
// and a number, and every field it reads is `undefined`
const due: { id: string }[] = await manager.query(
  `UPDATE "thing" SET … RETURNING "id"`, [.. ]);

// CORRECT
const [due]: [{ id: string }[], number] = await manager.query(
  `UPDATE "thing" SET … RETURNING "id"`, [.. ]);
```

It does not fail loudly: the wrong shape type-checks (the annotation is a
claim, not a check), `length` is the constant 2, and the loop body runs with
`undefined` in every field. Two claim-and-restage sweeps shipped this way and
went unnoticed for weeks — each one staged two jobs a tick carrying an
`undefined` id, which the processor logged as an unknown job and dropped,
while the rows they were supposed to recover were never picked up. The only
sign was a warning nobody read.

A test that fakes `manager.query` must return the **driver's** shape for the
statement it is faking, or it certifies the bug
(`automation-run-restage-stalled.repository.spec.ts` is the model).
