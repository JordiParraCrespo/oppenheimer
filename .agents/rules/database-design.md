---
paths:
  - "apps/api/src/migrations/**/*"
  - "apps/api/src/**/database/**/*"
  - "apps/api/src/config/data-source.ts"
  - "packages/backend/**/*"
---

# Database Design Rules

The schema is Postgres 16, written by hand in versioned TypeORM migrations
(`synchronize: false`, `migrationsRun` at boot). These rules are the standard a
new table is held to. `typeorm.md` covers the decorator mechanics; this file
covers the design. Designing a table from scratch is the `/design-database`
skill, which walks the process and ends on the checklist at the bottom here.

The migrations that already read the way a new one should:
`1781300000000-AddOutbox.ts` (an index named for the query it serves),
`1781400000000-AddOrgScopedRoles.ts` (partial uniques where NULLs would slip
through), `1781500000000-AddAccessGrants.ts` (a `CHECK`, a lookup index, a
partial expiry index), `1788600000000-AddUserSettings.ts` (the header
explains why this is a table of its own). Read one before writing a new one.

## Two kinds of table

- **Better Auth owns** `user`, `session`, `account`, `verification`,
  `organization`, `member`, `team`, `teamMember`, `invitation`, `oauth*` and
  `rateLimit`. Their table and column names are Better Auth's (camelCase, in
  quotes), because its own SQL has to find them. Do not rename them, do not
  change a column's type, and do not add a `NOT NULL` column without a default:
  Better Auth writes those rows and does not know about the column. A column
  the app adds to one of these tables must also be declared to Better Auth as
  an `additionalField` (see `session.delegated`). Adding indexes, foreign keys
  and `CHECK` constraints that Better Auth's own writes already satisfy is fine,
  and often needed.
- **The app owns everything else.** New tables are the app's.

## Naming

- Tables: `snake_case`, singular (`api_token`, `access_grant`,
  `invoice_line`). A join table is named after the relationship when it has
  one (`membership`), otherwise `<a>_<b>` (`user_role`).
- Columns: `camelCase` in quotes (`"organizationId"`, `"createdAt"`). This
  matches the Better Auth tables and the TypeORM property names, so there is no
  naming strategy and no `name:` on any `@Column`.
- Foreign-key columns: `<target>Id` (`"organizationId"`, `"authorId"`
  when the role matters more than the target).
- Booleans read as a fact: `isActive`, `emailVerified`, `delegated`. A state
  that has a time should be a timestamp instead (`revokedAt`, not `isRevoked`).
- Every constraint and index is named, never left to TypeORM's hash:
  `PK_<table>`, `FK_<table>_<target>`, `UQ_<table>_<cols>`,
  `IDX_<table>_<cols or purpose>`, `CHK_<table>_<rule>`. A readable name is what
  a later migration drops and what an error message shows.

## Keys

- Primary key: `"id" uuid NOT NULL DEFAULT gen_random_uuid()`, with
  `@PrimaryGeneratedColumn('uuid')`. High-volume append-only tables are the
  exception (see Scale). Better Auth tables take the id Better Auth
  generates (`@PrimaryColumn({ type: 'uuid' })`, no default).
- A table that is one row per parent uses the parent's id as its primary key
  (`user_settings."userId"`), not a surrogate plus a unique.
- A pure join table with no nullable part uses a composite primary key on the
  pair. When part of the uniqueness is nullable (a scope that may be global),
  use a surrogate `id` and partial unique indexes, as `user_role` does, or
  `UNIQUE NULLS NOT DISTINCT` (Postgres 15+) when one index says it.
- Natural keys (`slug`, `email`, `clientId`) are unique constraints, not
  primary keys. Put the tenant in the unique when the value is only unique
  inside a tenant: `UNIQUE ("organizationId", "slug")`.
- Case-insensitive uniqueness (emails, handles) is a unique index on
  `lower("email")`, and queries use the same expression.

## Foreign keys

- Every column that names a row in another table has a `FOREIGN KEY`. The
  exceptions are deliberate and written down in the migration header: an
  outbox or audit record that must outlive what it names
  (`outbox_message."aggregateId"`), or a polymorphic reference
  (`access_grant."resourceId"`), whose integrity the application owns.
- Choose `ON DELETE` on purpose, per relationship:
  - `CASCADE`: the child means nothing without the parent (`member` →
    `organization`, `api_token` → `user`).
  - `SET NULL`: the child outlives the parent and only loses a link
    (`invitation."teamId"`, `"createdById"` on content that stays). The
    column must be nullable.
  - `RESTRICT` / `NO ACTION`: deleting the parent while children exist is a
    bug (a `product` that orders still reference, a `currency`). Money and
    legal records are never cascaded away. `NO ACTION` is checked at the end of
    the statement, so an organization delete that cascades through both parent
    and child still succeeds; `RESTRICT` would refuse it.
  - When the business says "X may not be deleted while it has Y" (a comment
    with replies, a customer with invoices), the foreign key says it too:
    `NO ACTION`, never `CASCADE`, even though the application also checks. A
    cascade turns an application bug into silent data loss.
- **Every foreign key is backed by an index whose leading columns are the
  foreign key's columns** (all of them, for a composite key).
  Postgres does not create it. Without it a parent delete scans the whole
  child table under lock, and every "children of X" query does too.
- Cross-tenant references are prevented, not just discouraged: when a child and
  its parent both carry `"organizationId"`, reference the parent on
  `("organizationId", "id")` with a matching unique on the parent, so a row can
  never point into another tenant. When every parent reference is composite
  like this, the table needs no separate foreign key to `organization`: the
  composite keys already guarantee and cascade it.
- Adding that unique to a parent that already has rows is a lock on a hot
  table. `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE` builds the index under an
  `ACCESS EXCLUSIVE` lock (no reads or writes) until the boot transaction
  ends. Build it as `CREATE UNIQUE INDEX IF NOT EXISTS` (a `SHARE` lock:
  reads continue), which a foreign key can reference directly, and say in the
  header that on a large table it should be built `CONCURRENTLY` by hand
  first, under the same name.

## Columns and types

| Data | Type | Not |
| --- | --- | --- |
| Identifier | `uuid` | `varchar` |
| Point in time | `timestamptz` | `timestamp` (no zone) |
| Calendar date (birthday, due date) | `date` | `timestamptz` |
| Money | `bigint` minor units + `"currency" char(3)`, or `numeric(19,4)` | `float`, `real`, `double precision` |
| Exact decimal (rates, quantities) | `numeric(p,s)` | `float` |
| Counter | `integer`, `bigint` when it can pass 2 billion | |
| Short text with a real limit | `varchar(n)` (name 80, slug 64, prefix 32, hash 64) | unlimited `varchar` |
| Free text | `text` | |
| Enum-like value | `varchar(n)` + `CHECK ("x" IN (...))`, mirrored by a TS union | Postgres `ENUM` (adding a value can't run in a transaction, and removing one needs a rewrite) |
| Structured value the database never filters on | `jsonb` | `json`, `text` holding JSON |
| Epoch-millisecond value (only where Better Auth demands it) | `bigint` | |

- Timestamps are `timestamptz` in every table. In TypeORM the column names
  `TIMESTAMP_COLUMN_TYPE` from `@oppenheimer/backend-ddd`:
  `@CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })`,
  `@Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })` (`typeorm.md`).
- `NOT NULL` is the default. A column is nullable only when "unknown" or "not
  yet" is a real state, and the comment or name says which.
- Put a `DEFAULT` on every `NOT NULL` column that has an obvious initial value
  (`status`, counters, booleans, `'[]'` for a jsonb list). It makes the
  column safe to add to a table with rows.
- Every business rule the database can hold is a `CHECK`: `"amount" >= 0`,
  `"endsAt" > "startsAt"`, `"quantity" > 0`, `char_length("name") > 0`,
  one-of-two-columns-set (`num_nonnulls("userId", "teamId") = 1`).
- `jsonb` is for payloads, settings and lists that are read whole. A value the
  app filters, joins, sorts on or enforces uniqueness over is a column. A
  `jsonb` column that is queried by containment gets a `GIN` index
  (`jsonb_path_ops` when only `@>` is used).
- Data that arrives from another system (a payment provider, a webhook)
  carries that system's identity and its own time: `"provider"` plus
  `"externalId"`, unique together, and the event's own timestamp
  (`"issuedAt"`, `"occurredAt"`), which is what lists sort on. Webhooks arrive
  late and out of order, so the time the row was inserted is not the time the
  thing happened.
- A range with no upper bound is a bug waiting for an `'infinity'`: bound
  durations with a named `CHECK` (`isfinite("endsAt") AND "endsAt" -
  "startsAt" <= interval '7 days'`) wherever an open-ended row would block
  others. Without `isfinite`, `'infinity'` fails with an arithmetic error
  instead of the constraint's name.
- Secrets are never stored in the clear: store a SHA-256 hex digest
  (`varchar(64)`) with a unique index, plus a short non-secret display prefix,
  as `api_token` does.

## Timestamps and lifecycle

- Every table has `"createdAt" timestamptz NOT NULL DEFAULT now()`.
- Every table whose rows change has
  `"updatedAt" timestamptz NOT NULL DEFAULT now()`, maintained by
  `@UpdateDateColumn`. An append-only table (events, audit, ledger entries)
  has no `updatedAt`, and its header says it is append-only.
- A state change that matters gets its own timestamp, and often an actor:
  `"revokedAt"`, `"acceptedAt"`, `"publishedAt"`, `"cancelledById"`. A
  status column says where the row is; the timestamps say when it got there.
- Expiring rows have `"expiresAt"`, and the migration header says what removes
  them (a scheduled job, or a delete on read). A table that only grows needs a
  retention plan written down: how long rows live, and what deletes them.
- **Soft delete only when there is a reason**: undo, legal retention, or
  history that must still resolve. Then `"deletedAt" timestamptz`, every
  unique becomes a partial unique `WHERE "deletedAt" IS NULL`, and the hot
  indexes are partial on the same predicate. Without a reason, delete the
  row; a soft-deleted row that every query has to remember to exclude is where
  data leaks come from.
- Rows edited concurrently by people or processes (documents, settings shared
  by a team, a balance) get `"version" integer NOT NULL DEFAULT 1`
  (`@VersionColumn`) for optimistic locking, or are updated with a guarded
  `UPDATE ... WHERE "version" = $n`.

## Indexes

An index exists because of a query. For each one, the migration says which
query it serves, as the outbox migration does.

- Write down the access patterns before the indexes: each list, lookup, filter,
  sort and join the module will run. Every one needs an index that serves it,
  and no index should exist that serves none.
- **Composite index column order**: equality columns first, then the range or
  sort column. The tenant goes first in a multi-tenant table:
  `("organizationId", "status", "createdAt")` serves "this org's open items,
  newest first".
- A composite index `(a, b)` also serves queries on `a` alone. Do not add a
  separate index on `a`.
- Paginated lists are keyset-paginated on a unique ordering, so the index ends
  in a tiebreaker: `("organizationId", "createdAt", "id")`.
- Do not write `DESC` in an index for a single-direction sort: a B-tree is
  scanned backwards for `ORDER BY "createdAt" DESC, "id" DESC` at no cost, and
  TypeORM's `@Index` cannot express `DESC`, so the entity and the migration
  would disagree. `DESC` is for mixed directions (`"priority" DESC,
  "createdAt" ASC`) only, and then the entity's `@Index` is
  `synchronize: false`.
- **Partial indexes** for the hot subset: `WHERE "deletedAt" IS NULL`,
  `WHERE "status" = 'pending'`, `WHERE "expiresAt" IS NOT NULL`. They are
  smaller and faster, and they are how "unique among active rows" is said.
- `IS NULL` is not an equality for ordering: in an index
  `("taskId", "parentId", "createdAt")`, a query on `"parentId" IS NULL
  ORDER BY "createdAt"` still sorts. Put a null test the query always makes
  in the predicate instead: `("taskId", "createdAt", "id") WHERE "parentId"
  IS NULL`. Prove the order with `EXPLAIN` (no `Sort` above the index scan).
- Case-insensitive lookups need an expression index (`lower("email")`), and
  text search needs `pg_trgm` GIN or `tsvector`, not `LIKE '%x%'` on a
  B-tree.
- Low-cardinality columns (`boolean`, a three-value status) are almost never
  worth an index on their own. They belong inside a composite or as a partial
  predicate.
- Each index costs every write. A table that is written far more than it is
  read (logs, events) carries only the indexes its readers need.

## Multi-tenancy

- A table holding tenant data carries `"organizationId" uuid NOT NULL`, a
  foreign key to `organization` with `ON DELETE CASCADE` (high-volume logs
  are the exception, see Scale), and leads its
  indexes and tenant-scoped uniques with it. It is a column even when it could
  be reached through a parent join: it is what every query filters on first,
  and what a later partitioning or row-level-security step keys on.
- Global rows in a table that is otherwise per-tenant (the seeded system roles)
  use `"organizationId" IS NULL`, with partial uniques for each shape.

## Scale

Design for the table at a hundred times today's size.

- A column rewritten often (`lastSeenAt`, a counter, a heartbeat) does not
  belong on a wide, heavily read and indexed row such as `user` or
  `organization`: every update writes a new row version and, when the column
  is indexed, a new entry in every index on the table. Put it in a narrow side
  table keyed by the parent's id.
- An update skips index maintenance (a HOT update) only when no changed column
  appears in any index, including inside a partial index's `WHERE` predicate.
  A partial index on `"onHand" - "reserved" <= "reorderPoint"` makes every
  stock update write every index on the row; `fillfactor` does not change
  that. Weigh such an index against the write rate of the columns it names.
- An insert-heavy table keyed by random `gen_random_uuid()` scatters inserts
  across the whole primary-key index. For tables that grow by millions of rows,
  prefer `bigint GENERATED ALWAYS AS IDENTITY`, or a time-ordered UUIDv7
  generated by the application (Postgres 16 has no `uuidv7()`).

- Know which tables grow without bound (events, audit, messages, usage,
  notifications). Give them a `bigint` or `uuid` key, a retention plan, and
  indexes that serve their time-ordered reads (a `BRIN` index on the time
  column is a cheap way to serve a retention delete). Under a few tens of
  millions of rows a plain table with batched retention deletes is enough; say
  in the header that it is a partitioning candidate, and keep the primary key
  compatible (a partitioned table needs the partition column in every
  unique). Past that, partition by month on the time column from the start,
  with a `DEFAULT` partition as a safety net, a scheduled job that creates
  partitions ahead (computed in UTC), and retention as `DROP` of old
  partitions.
- A high-volume log does not hang off the tenant with `ON DELETE CASCADE`:
  deleting a large organization would delete millions of rows in the same
  transaction. Keep `"organizationId"` without a foreign key (the header
  says so) and erase a tenant's rows with the batched purge or partition drop.
- Counters that many requests bump at once (views, likes) do not live on a
  hot parent row. Write them to their own table, or aggregate them.
- Queues and work tables are claimed with `FOR UPDATE SKIP LOCKED` on a
  `(status, availableAt)` index, as `outbox_message` is.

## Migrations

- One migration per change, named for what it does
  (`1789000000000-AddInvoices.ts`), with a header comment explaining **why**:
  the design decisions, the relationships that were considered, and anything
  deliberately left out. The existing headers are the model.
- `down()` reverses `up()` exactly: drop in reverse order, and restore data a
  backfill moved.
- Statements that can run twice without harm when practical: `IF NOT EXISTS`,
  `ON CONFLICT DO NOTHING`, `WHERE NOT EXISTS` in seeds and backfills.
- **Changes to a table that already has rows are lock-aware**:
  - Adding a column: nullable, or `NOT NULL` with a constant `DEFAULT` (instant
    since Postgres 11). Never add `NOT NULL` without a default to a populated
    table.
  - Adding an index to a large table: `CREATE INDEX CONCURRENTLY`, which cannot
    run in a transaction. Migrations here run in TypeORM's default
    `migrationsTransactionMode: 'all'`, which refuses a migration that sets
    `transaction = false`; switching the data sources to `'each'` is its own
    change. Until then, a new table's indexes are created with the table (it is
    empty, so nothing is locked), and an index on a table that is already large
    is called out in the PR so it can be built by hand, concurrently, first.
  - Adding a foreign key or `CHECK` to a large table: add it `NOT VALID`, then
    `VALIDATE CONSTRAINT` in a separate statement.
  - Changing a column type, renaming a column that code still reads, or
    tightening a constraint: expand and contract. Add the new shape, backfill
    in batches, switch the code, drop the old shape in a later migration.
  - Backfills of more than a few thousand rows run in batches, not one
    `UPDATE` over the table.
  - A batched delete or update picks its batch through an index and then
    touches only those rows: `DELETE FROM t WHERE ctid = ANY (ARRAY(SELECT
    ctid FROM t WHERE "occurredAt" < $cutoff LIMIT 5000))`. The plan is a
    `Tid Scan` under an index-driven `InitPlan`. The tempting
    `WHERE "id" IN (SELECT "id" ... LIMIT 5000)` plans as a hash semi join
    over a sequential scan of the whole table, on every batch (checked on
    Postgres 16).
  - Migrations run at boot, all in one transaction, so every lock a migration
    takes is held until the last one finishes. Creating a foreign key takes a
    `SHARE ROW EXCLUSIVE` lock on the referenced table, which blocks its
    writes: a new table referencing `user`, `session` or `organization` is
    fine on its own, but not alongside a backfill that reads a large table.
    Keep large backfills out of boot migrations (a one-off job or command),
    and keep migrations that touch hot tables short.
  - A `SET LOCAL lock_timeout` lasts until the transaction ends, which here is
    the end of every boot migration, not just this one. A migration that sets
    it runs `RESET lock_timeout` as its last statement.
  - **Changing a hot table that already has millions of rows** (`session`,
    `user`, `member`, a large tenant table) is an operation, not just a
    migration. `lock_timeout` bounds the wait for a lock, not how long it is
    held, and at boot every lock is held until all migrations commit. So:
    - Long, non-blocking steps (`CREATE INDEX CONCURRENTLY`, `VALIDATE
      CONSTRAINT`, batched orphan cleanup, backfills) run outside the boot
      transaction: as a documented one-off command or script run before the
      deploy, each in its own short transaction with a `lock_timeout` and a
      retry. The boot migration then only asserts they happened (it fails
      the deploy with a clear message if the index is missing or invalid, or
      the constraint is not validated), and builds them itself on small
      databases (development, CI).
    - The remaining instant `ACCESS EXCLUSIVE` step (a catalog-only `ALTER`,
      adding a `NOT VALID` constraint) ships in its own release with a short
      `lock_timeout`, so nothing else holds the lock open after it.
    - Do not switch the data sources to `migrationsTransactionMode: 'each'` as
      a side effect of one change: it makes every migration commit on its own,
      so a failed boot leaves the schema half-migrated. If the project wants
      that, it is its own decision and its own PR.
    - A type change the catalog can do without a rewrite (`timestamp` to
      `timestamptz` with `SET LOCAL TimeZone = 'UTC'` on Postgres 12+,
      widening a `varchar`) is still an `ACCESS EXCLUSIVE` lock: follow the
      point above, check the server version first, and `ANALYZE` the table
      after. Converting to `timestamptz` reads the stored values in the
      migration's `TimeZone`, so check what the writers used: the database
      default (`SELECT setting FROM pg_settings WHERE name = 'TimeZone'`
      outside the migration's `SET LOCAL`) and the app's. When the column is
      Better Auth's, say that Better Auth reads and writes `Date` through
      `pg` and is unaffected.
    - Delete orphans after the `NOT VALID` constraint exists (it stops new
      ones), then validate.
- **The migration is the source of truth**, and the ORM entity mirrors it:
  every column's type, length, nullability and default; every unique
  (`@Unique('UQ_...', [...])`); every `CHECK` (`@Check('CHK_...', ...)`);
  every index (`@Index('IDX_...', [...])`, with `where:` for a partial index,
  and `synchronize: false` for what TypeORM cannot express: expression, GIN,
  BRIN or mixed-direction indexes). The entities here do not declare
  relations (`@ManyToOne`), so foreign keys live only in the migration and
  `migration:generate` is not a diff check for them: write migrations by
  hand.
- "Do it to all of them" operations (mark all as read, archive all, bulk
  status changes) are bounded: by a snapshot (`"createdAt" <= $requestTime`,
  so rows arriving mid-request are not swept up) and by batch size, served by
  an index that matches the filter.
- A new ORM entity is added to the `entities` list in
  `apps/api/src/config/data-source.ts`.

## Review checklist

Before a migration is done, each of these holds:

1. The access patterns are written down, and each has an index that serves it.
2. Every foreign-key column has a `FOREIGN KEY` with a chosen `ON DELETE`, and an
   index; or the header says why it has neither.
3. Every timestamp is `timestamptz`; `createdAt` everywhere, `updatedAt` on
   every table whose rows change.
4. No unlimited `varchar` where a limit is real; no `float` for money; enum-like
   columns have a `CHECK`.
5. Every constraint and index has a readable name.
6. Tenant data carries `"organizationId"` and leads its indexes and uniques.
7. Uniqueness is enforced by the database, including the nullable and
   soft-deleted cases.
8. Unbounded tables have a retention plan.
9. The migration is safe on a table with rows (no long lock held on a hot
   table, no unbatched backfill), and `down()` reverses it.
10. The ORM entity mirrors the SQL (columns, uniques, checks, index names and
    partial predicates), and is registered in `data-source.ts`.
11. Every rule of the form "may not be deleted while..." is a `NO ACTION`
    foreign key, not only an application check.
12. The migration ran on a real Postgres (`check-migration.mjs` in the
    `/design-database` skill): `up`, `down`, `up` against seeded rows, and
    each access pattern's plan uses its index without an extra `Sort`.
