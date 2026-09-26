---
name: design-database
description: Design Postgres tables for the Oppenheimer API the way a senior database engineer would. It starts from access patterns, then sets keys, types, constraints, foreign keys, indexes, timestamps, tenancy, lifecycle and scale, and produces the TypeORM migration and ORM entities. Use it whenever the user asks for a new table, schema, data model, entity, migration or relationship in apps/api. Also use it when a new API module needs persistence, when they describe a feature that must store data ("we need to track invoices", "add comments to posts"), or when they ask to review, fix or scale an existing schema, even if they never say "database".
---

# Design a database schema

This skill turns a feature into tables a senior Postgres engineer would sign
off on. The standard those tables are held to is
`.agents/rules/database-design.md`. Read it first: it holds the naming, types,
keys, index rules and the review checklist. This skill is the process that
gets there, so the rules are applied because of the queries, not recited.

The existing migrations in `apps/api/src/migrations/` are the house style. The
ones worth reading before writing a new one: `1781300000000-AddOutbox.ts`,
`1781400000000-AddOrgScopedRoles.ts`, `1781500000000-AddAccessGrants.ts`,
`1788600000000-AddUserSettings.ts`. Do not copy the older ones' `TIMESTAMP`
(no time zone) or unnamed constraints.

## 1. Understand the data before drawing tables

Work out, from the request and the code around it:

- **The nouns and their relationships.** Cardinality of each (1:1, 1:N, M:N),
  and which side can exist without the other.
- **Ownership.** Is this tenant data (belongs to an `organization`), a user's
  own data, or global? Almost everything a customer creates is tenant data.
- **Lifecycle.** How a row is created, which states it moves through, whether it
  is edited, whether it is ever deleted, and what must survive a delete
  (invoices do; draft comments don't).
- **Volume and growth.** Rows per tenant, per day, forever? Which tables are
  bounded (settings, roles) and which grow without end (events, messages,
  audit, usage)?
- **Concurrency.** Can two people or processes change the same row at once?

When something here changes the design and cannot be inferred, ask. Otherwise
state the assumption in the design notes and move on. A design with its
assumptions written down can be corrected; a question list blocks the user.

## 2. Write the access patterns

List every query the feature will run, as a table. This is what the indexes
are derived from, and it is the step most schemas skip.

| # | Query | Filter / sort | Frequency |
| --- | --- | --- | --- |
| Q1 | List an org's open invoices, newest first, paginated | `organizationId`, `status`; `createdAt DESC` | every page view |
| Q2 | Fetch an invoice by number within an org | `organizationId`, `number` | often |
| Q3 | Invoices past due, for the reminder job | `status = 'open'`, `dueOn < today` | hourly |

Include writes that search (a uniqueness check, a claim query), the reads
behind every endpoint, the background jobs, and the deletes that cascade.

## 3. Model the tables

For each table decide, using the rule file:

- Name (`snake_case` singular), primary key, and whether it is app-owned or
  touches a Better Auth table (then Better Auth's constraints apply).
- Each column's type, nullability, default and `CHECK`. Money, time, enums and
  secrets have fixed answers in the rule file's type table.
- Each foreign key and its `ON DELETE`, chosen from what the relationship
  means, plus the index behind it.
- `createdAt`, and `updatedAt` unless the table is append-only; a timestamp
  (and maybe an actor) for each lifecycle transition that matters.
- Uniqueness the business needs, scoped to the tenant, and correct for NULLs
  and soft-deleted rows.

Recurring shapes, including tenant children, join tables, state machines,
ledgers, audit logs, soft delete, trees, polymorphic links, tags, queues,
idempotency keys, non-overlapping bookings and stock that must never go
negative, are in `references/patterns.md`. Read the ones that apply.

Prefer the simplest design that holds. No soft delete without a reason, no
`jsonb` for data that is queried, no extra table for a 1:1 without a reason
(different lifecycle, different owner, or a Better Auth table the app should
not write), and no index without a query.

## 4. Derive the indexes

Walk the access-pattern table and give each query an index, then remove the
redundant ones:

- Equality columns first, then the range or sort column; the tenant leads.
- Keyset-paginated lists end in the ordering column plus `id`, ascending;
  Postgres scans the index backwards for newest-first.
- A partial index when the query only reads a subset (`WHERE "status" =
  'pending'`, `WHERE "deletedAt" IS NULL`).
- Every foreign key's columns are the leading columns of some index.
- Drop any index whose columns are a prefix of another's.

Name each index for its columns or its purpose, and in the migration put a
one-line comment above it naming the query it serves (`-- Q1`).

## 5. Write the code

Produce, following `references/templates.md`:

1. **The migration** `apps/api/src/migrations/<timestamp>-<PascalCaseName>.ts`.
   The timestamp is later than the newest existing one. The header comment
   explains the design: what the tables are for, the choices made and why,
   what was deliberately left out, the retention plan for anything that grows
   without bound. SQL in multi-line template strings, one statement per
   `queryRunner.query`, every constraint named. `down()` drops everything in
   reverse.
2. **One ORM entity per table** `<module>/database/<table>.orm-entity.ts`,
   matching the SQL exactly (types, lengths, nullability, defaults,
   `@Index` names), with `timestamptz` on every date column.
3. **Registration** of each entity in `apps/api/src/config/data-source.ts`.

When the user asked for the whole module, hand the rest to `/scaffold-module`;
this skill owns the `database/` persistence models and the migration.

## 6. Review against the checklist

Run the checklist at the end of `database-design.md` against what you wrote,
item by item. Then check it as the person who will run it in production:

- What happens to these rows when the organization, the user, or the parent
  is deleted? Is that what the business wants?
- Which query gets slow first at 100x the data, and does an index cover it?
- Can a bug in application code put a row into a state the business says is
  impossible? If a `CHECK`, `UNIQUE` or `FOREIGN KEY` could stop it, add it.
- Can a row in one tenant reference a row in another?
- For each rule "X may not be deleted while it has Y": is the foreign key
  `NO ACTION`, so the database enforces it even if the app forgets?
- Which locks does the migration take on tables that already have rows, and
  for how long, given all boot migrations share one transaction?
- Does every `CHECK`, unique and partial predicate in the SQL appear on the
  entity?

Fix what this finds before presenting.

## 7. Prove it on Postgres

A review on paper misses what the database sees: a `CHECK` that allows what
it claims to forbid, an index that cannot give the order a list needs, a
migration that fails on a table with rows. When a Postgres is reachable
(`pnpm docker:dev`, configured by `DB_*` in the root `.env`), run:

```bash
node --experimental-strip-types .agents/skills/design-database/scripts/check-migration.mjs \
  apps/api/src/migrations/<your-migration>.ts \
  [--before stubs.sql] [--fixture rows.sql] [--explain queries.sql]
```

It applies every existing migration to a scratch database, seeds a few
production-like rows, runs your `up()`, `down()` and `up()` again, then prints
the plan of each query in `--explain` with sequential scans switched off.

- Write `queries.sql` straight from the access-pattern table, one query per
  row, headed by a `-- Q1 ...` comment, with the exact predicates the code will
  use. The plan must name the index you assigned. A `Sort` above it means the
  index does not give that order; fix the index, not the table.
- Put a few `INSERT`s that must fail in the fixture file only when you want to
  prove them; otherwise probe the one or two rules that matter most by hand
  with `--keep` and `psql`.
- `--before` creates tables the design assumes but the repo does not have yet.

If no database is reachable, say so in the summary and list the queries to
check; do not claim the plans.

## 8. Present the design

End with a short summary for the user:

- The tables and their relationships (a compact list, or a small ASCII
  diagram when there are more than three tables).
- The access-pattern table with the index that serves each query, and
  whether `check-migration.mjs` proved it (or why it could not run).
- The decisions worth a second look (each `ON DELETE`, soft delete or not,
  anything assumed) and the assumptions made in step 1.
- Follow-ups outside this change (a retention job, an endpoint's
  `generate:api-client`).
