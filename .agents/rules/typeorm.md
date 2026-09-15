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

// Also applies to Date | null without explicit type
@Column({ nullable: true, type: 'timestamp' })
resetPasswordExpires!: Date | null;
```

Non-union types (`string`, `number`, `boolean`, `Date`) reflect correctly and don't need an explicit `type`.

## Entity conventions

TypeORM entities are **persistence models**, not domain entities. Name them
`<module>.orm-entity.ts` and place them in the module's `database/` folder; the
domain `Entity`/`AggregateRoot` lives in `domain/` and is mapped to/from the ORM
record by the mapper (`toDomain` / `toPersistence`). See `nestjs-architecture.md`.

- Use `@PrimaryGeneratedColumn('uuid')` for IDs the app owns. Tables owned by
  Better Auth (e.g. `user`) use `@PrimaryColumn({ type: 'uuid' })` because Better
  Auth generates the id.
- Use `@CreateDateColumn()` and `@UpdateDateColumn()` for timestamps
- Sensitive fields (password, refreshToken) must never appear on the response
  DTO — the mapper's `toResponse()` only copies safe fields
- When writing only the columns the app owns (e.g. profile fields on a Better
  Auth table), leave the rest unset in `toPersistence()` so `save()` doesn't
  clobber columns another system manages
