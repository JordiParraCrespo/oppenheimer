# Schema patterns

Recurring shapes, each with the design and the reason for it. Read the ones
the feature needs. Types, naming and the index rules are in
`.agents/rules/database-design.md`; these examples follow them.

## Contents

1. Tenant-owned table
2. Child of a tenant-owned table (no cross-tenant links)
3. Many-to-many join
4. State machine with transition timestamps
5. Money and ledgers
6. Append-only event or audit log
7. Soft delete
8. Trees and hierarchies
9. Polymorphic references
10. Tags and labels
11. Work queue
12. Idempotency keys
13. Per-user or per-tenant settings (1:1)
14. Concurrent edits (optimistic locking)
15. Counters
16. Non-overlapping ranges (bookings, schedules)
17. Stock and balances that must never go negative

---

## 1. Tenant-owned table

```sql
CREATE TABLE "project" (
  "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "name"           character varying(120) NOT NULL,
  "slug"           character varying(64) NOT NULL,
  "createdById"    uuid,
  "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_project" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_project_organization_slug" UNIQUE ("organizationId", "slug"),
  CONSTRAINT "CHK_project_name_not_blank" CHECK (char_length(btrim("name")) > 0),
  CONSTRAINT "FK_project_organization" FOREIGN KEY ("organizationId")
    REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_project_created_by" FOREIGN KEY ("createdById")
    REFERENCES "user"("id") ON DELETE SET NULL
);
-- The org's project list, newest first (keyset-paginated; the B-tree is scanned backwards).
CREATE INDEX "IDX_project_organization_created" ON "project" ("organizationId", "createdAt", "id");
-- FK index: a user delete sets these to NULL.
CREATE INDEX "IDX_project_created_by" ON "project" ("createdById");
```

- `organizationId` is `NOT NULL`, leads the unique and the list index. The
  unique also serves "by slug within an org" and the org FK's lookups, so
  the FK needs no separate index.
- `createdById` is `SET NULL`: the project outlives its creator.

## 2. Child of a tenant-owned table

Carry the tenant on the child too, and make the child's foreign key include
it, so a child can never point at a parent in another tenant:

```sql
-- on the parent
ALTER TABLE "project" ADD CONSTRAINT "UQ_project_organization_id" UNIQUE ("organizationId", "id");

CREATE TABLE "task" (
  "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "projectId"      uuid NOT NULL,
  ...
  CONSTRAINT "FK_task_project" FOREIGN KEY ("organizationId", "projectId")
    REFERENCES "project"("organizationId", "id") ON DELETE CASCADE,
  CONSTRAINT "FK_task_organization" FOREIGN KEY ("organizationId")
    REFERENCES "organization"("id") ON DELETE CASCADE
);
CREATE INDEX "IDX_task_organization_project" ON "task" ("organizationId", "projectId");
```

The redundant `organizationId` is what every query filters on first, and what
row-level security or partitioning would key on later.

## 3. Many-to-many join

No payload and nothing nullable: composite primary key, plus an index on the
reverse direction.

```sql
CREATE TABLE "project_member" (
  "projectId" uuid NOT NULL,
  "userId"    uuid NOT NULL,
  "role"      character varying(16) NOT NULL DEFAULT 'viewer',
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_project_member" PRIMARY KEY ("projectId", "userId"),
  CONSTRAINT "CHK_project_member_role" CHECK ("role" IN ('viewer', 'editor', 'admin')),
  ...FKs, both ON DELETE CASCADE
);
-- "Projects this user belongs to"; the PK already serves "members of this project".
CREATE INDEX "IDX_project_member_user" ON "project_member" ("userId");
```

If part of the uniqueness can be NULL (a global vs scoped assignment), use a
surrogate `id` plus partial uniques, as `user_role` does, or
`UNIQUE NULLS NOT DISTINCT (...)`.

## 4. State machine with transition timestamps

```sql
"status"      character varying(16) NOT NULL DEFAULT 'draft',
"submittedAt" TIMESTAMP WITH TIME ZONE,
"approvedAt"  TIMESTAMP WITH TIME ZONE,
"approvedById" uuid,
CONSTRAINT "CHK_expense_status" CHECK ("status" IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
CONSTRAINT "CHK_expense_approved_has_time" CHECK ("status" NOT IN ('approved', 'paid') OR "approvedAt" IS NOT NULL)
```

`status` is where the row is now; the timestamps are when it got there, and
the `CHECK`s keep the two consistent. The TypeScript union for the status
lives beside the domain entity and matches the `CHECK` list. When the full
history matters (who moved it, each time), add an append-only
`<table>_event` table (pattern 6) rather than more columns.

## 5. Money and ledgers

- Amounts are `bigint` in minor units (cents) with `"currency" char(3)`
  (`CHECK ("currency" ~ '^[A-Z]{3}$')`), or `numeric(19,4)` when fractions of a
  minor unit matter (unit prices, FX). Never floating point.
- Totals on a document (`invoice."totalAmount"`) are either computed from the
  lines or stored and kept equal to them in the same transaction. Say which.
- A balance is a ledger: an append-only `ledger_entry` of signed amounts, and
  the balance is their sum, optionally cached on the account row and updated
  in the same transaction with a `version` guard. Entries are never updated or
  deleted; a correction is a reversing entry.
- Financial rows are `ON DELETE RESTRICT` toward their parents. An invoice
  does not disappear because a customer was deleted, which usually means
  customers are archived, not deleted.
- Snapshot what the document must keep even if the source changes: the line
  stores `description` and `unitPrice` at the time of sale, not only a
  `productId`.

## 6. Append-only event or audit log

```sql
CREATE TABLE "audit_event" (
  "id"             bigint GENERATED ALWAYS AS IDENTITY,
  "organizationId" uuid NOT NULL,   -- no FK: see below
  "actorType"      character varying(16) NOT NULL,  -- 'user' | 'api_token' | 'system'
  "actorId"        uuid,            -- no FK: the log outlives the user
  "actorLabel"     character varying(255),  -- snapshot, so the log reads after the user is gone
  "action"         character varying(64) NOT NULL,
  "targetType"     character varying(32) NOT NULL,
  "targetId"       uuid,            -- polymorphic: no FK
  "changes"        jsonb NOT NULL DEFAULT '{}',
  "ipAddress"      inet,
  "occurredAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_audit_event" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_audit_event_actor_type" CHECK ("actorType" IN ('user', 'api_token', 'system')),
  CONSTRAINT "CHK_audit_event_changes_size" CHECK (pg_column_size("changes") <= 65536)
);
CREATE INDEX "IDX_audit_event_org_time" ON "audit_event" ("organizationId", "occurredAt");
CREATE INDEX "IDX_audit_event_org_actor_time" ON "audit_event" ("organizationId", "actorId", "occurredAt") WHERE "actorId" IS NOT NULL;
CREATE INDEX "IDX_audit_event_org_target_time" ON "audit_event" ("organizationId", "targetType", "targetId", "occurredAt");
-- Retention delete scans by time across tenants.
CREATE INDEX "IDX_audit_event_occurred_brin" ON "audit_event" USING BRIN ("occurredAt");
```

- No `updatedAt`, since rows never change. Say "append-only" in the header,
  and consider enforcing it with a trigger that rejects `UPDATE` (the
  repository must then use `insert()`, not `save()`). Make it
  `FOR EACH ROW`: on a partitioned table only row-level triggers are cloned
  to the partitions, so a statement-level one is bypassed by an `UPDATE` that
  names a partition directly.
- An actor may be a user, a token or the system, so `actorId` is nullable and
  typed by `actorType`. Snapshot the labels a reader needs after the actor or
  target is deleted.
- References are FK-less so history survives deletes, including the tenant:
  a `CASCADE` from `organization` would delete millions of rows inside the
  organization delete. Tenant erasure is the retention job run for that
  tenant (batched) or a partition drop.
- A `bigint` identity key keeps inserts at the right edge of the index; a
  random UUID key would scatter them. Expose it only inside the org, or add a
  public uuid if ids leave the API.
- Unbounded: state the retention period and the scheduled job that enforces
  it. Size it: at a few million rows a year, a plain table with a batched
  delete over the BRIN index is enough, and the header names partitioning as
  the next step. At tens of millions or more, partition by month on
  `occurredAt` now (the primary key becomes `("id", "occurredAt")`, and the
  id comes from a plain sequence: Postgres 16 has no identity columns on
  partitioned tables), with a `DEFAULT` partition, a job that creates next
  months' partitions and retention as `DROP` of old partitions. Compute month
  bounds on `timestamp` values and convert with `AT TIME ZONE 'UTC'`: month
  arithmetic on `timestamptz` follows the session time zone and leaves gaps.
  The job that runs these functions is part of the design, not a
  follow-up: without it, rows pile into the `DEFAULT` partition. The
  retention job also deletes expired rows from the `DEFAULT` partition (a
  partition drop never reaches them), and an alert fires when it holds any.
- Index for the reads (per tenant timeline, per actor, per target) and
  nothing else; this table is written far more than it is read.

## 7. Soft delete

Only with a reason: undo, legal retention, or references that must still
resolve. Then:

```sql
"deletedAt" TIMESTAMP WITH TIME ZONE,
"deletedById" uuid,
-- uniqueness among live rows only
CREATE UNIQUE INDEX "UQ_document_org_slug_live" ON "document" ("organizationId", "slug") WHERE "deletedAt" IS NULL;
-- the hot list only reads live rows
CREATE INDEX "IDX_document_org_updated_live" ON "document" ("organizationId", "updatedAt") WHERE "deletedAt" IS NULL;
```

Plus a purge: how long soft-deleted rows stay, and what hard-deletes them.
A soft-deleted row whose content must disappear (a deleted comment's text)
also clears that content, keeping only what the placeholder needs.
This repo does not use TypeORM soft delete (`typeorm.md`): `deletedAt` is a
plain `@Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })`, and every
read adds the `"deletedAt" IS NULL` predicate itself.

## 8. Trees and hierarchies

- **Adjacency list** (`"parentId" uuid` self-FK, indexed) for shallow trees
  and "children of X"; recursive CTEs for subtrees.
- Add a **materialized path** (`"path" text` like `/a/b/c/`, indexed with
  `text_pattern_ops`, or `ltree`) when subtree reads are hot, and maintain it
  on move.
- `CHECK ("parentId" <> "id")`; deeper cycle prevention, or a depth limit
  (one level of replies), lives in a trigger, since a `CHECK` cannot read
  another row.
- `ON DELETE`: `CASCADE` deletes the subtree; `NO ACTION` makes the database
  refuse to delete a node that has children. When the product keeps a node
  that has children (a deleted comment shown as "deleted" in its thread), use
  `NO ACTION`: the app turns the node into a placeholder, and a bug that
  hard-deletes it fails loudly instead of silently deleting the replies.

## 9. Polymorphic references

One table that points at several kinds of target (comments on tasks and on
documents):

- **Preferred when the set is small and fixed**: one nullable FK column per
  target with `CHECK (num_nonnulls("taskId", "documentId") = 1)`. Real foreign
  keys, real cascades, one index per column.
- **When the set is open**: `"targetType" varchar + "targetId" uuid` with a
  `CHECK` on the type list and a composite index `("targetType", "targetId")`.
  No FK is possible, so the header says what cleans up orphans (the target's
  delete handler, or a sweep job). `access_grant` is this shape.

## 10. Tags and labels

A `tag` table per tenant (`UNIQUE ("organizationId", lower("name"))`) and a
join table to the tagged rows, not a `text[]` or `jsonb` column, when tags
are managed (renamed, coloured, listed with counts). A plain `text[]` with a
GIN index is fine for free-form labels that are only filtered on.

## 11. Work queue

The `outbox_message` shape: `status`, `attempts`, `availableAt`, `lockedBy`,
`lockedUntil`, `lastError`, and a `("status", "availableAt")` index (or a
partial index `WHERE "status" = 'pending'`). Claimed with
`FOR UPDATE SKIP LOCKED`; a lapsed lease makes a row reclaimable. Processed
rows are deleted or moved on a schedule, so the table stays small.

## 12. Idempotency keys

For operations a client may retry (payments, webhooks received):

```sql
"idempotencyKey" character varying(128) NOT NULL,
CONSTRAINT "UQ_payment_org_idempotency" UNIQUE ("organizationId", "idempotencyKey")
```

Insert with `ON CONFLICT DO NOTHING` and read back. For inbound webhooks, the
provider's event id is the key. Keys expire with a retention job when the
table is not otherwise bounded.

## 13. Per-user or per-tenant settings (1:1)

The parent's id is the primary key and the FK (`user_settings."userId"`), with
`ON DELETE CASCADE`. Defaults live in the column `DEFAULT`s, and a missing
row means "all defaults", so no backfill is needed. A separate table rather
than columns on the parent when the lifecycle or the owner differs (settings
on a Better Auth table would be written through Better Auth).

## 14. Concurrent edits (optimistic locking)

`"version" integer NOT NULL DEFAULT 1` with TypeORM's `@VersionColumn()`, or
a guarded `UPDATE ... SET "version" = "version" + 1 WHERE "id" = $1 AND
"version" = $2`, where zero rows updated means a conflict (HTTP 409). Use it for
documents, shared settings and balances, anything two people edit.

## 15. Counters

A count on a hot parent row (`post."likeCount"`) serializes every writer on
that row. Keep the facts (`post_like` rows, unique per user and post) and
either count them with an index, or maintain the counter asynchronously (a job
or the outbox). A denormalized counter that is updated in the same
transaction is acceptable only when writes to that parent are rare.

## 16. Non-overlapping ranges (bookings, schedules)

"Two active bookings of a room may never overlap" is an exclusion
constraint, not an application check, because two concurrent inserts both
see the slot as free:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- uuid equality inside a GiST constraint
...
"startsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
"endsAt"   TIMESTAMP WITH TIME ZONE NOT NULL,
"cancelledAt" TIMESTAMP WITH TIME ZONE,
CONSTRAINT "CHK_booking_period" CHECK ("endsAt" > "startsAt"),
CONSTRAINT "CHK_booking_max_duration" CHECK ("endsAt" - "startsAt" <= interval '7 days'),
CONSTRAINT "EXCL_booking_no_overlap" EXCLUDE USING gist (
  "roomId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("cancelledAt" IS NULL)
```

- `'[)'` makes back-to-back bookings legal (10:00-11:00 and 11:00-12:00).
- The predicate leaves cancelled rows out, so cancelling frees the slot and
  the row stays for history.
- The constraint's GiST index also serves "a room's schedule for a day" and
  "is it free", when the query writes the same range expression and
  predicate. "My upcoming bookings" needs its own B-tree on
  `("userId", "endsAt")` (`endsAt`, so a meeting in progress still shows).
- A violation is SQLSTATE `23P01`; the repository maps it to a 409.
- The entity declares it with `@Exclusion('EXCL_...', '...')`, or leaves it
  to the migration and says so.
- Keep `btree_gist` in `down()`: it is database-wide, and something else may
  rely on it.

## 17. Stock and balances that must never go negative

```sql
"onHand"   integer NOT NULL DEFAULT 0,
"reserved" integer NOT NULL DEFAULT 0,
CONSTRAINT "CHK_stock_level_no_oversell" CHECK ("reserved" >= 0 AND "onHand" >= "reserved")
```

- The `CHECK` is the last line of defence; the write path is one guarded
  statement, never read-then-write:
  `UPDATE ... SET "reserved" = "reserved" + $q WHERE <key> AND "onHand" - "reserved" >= $q RETURNING ...`.
  No row back means not enough stock. Concurrent buyers queue on the row lock
  and each is re-checked against committed values.
- Multi-line carts lock rows in a fixed order (`warehouseId`, `productId`) so
  two carts cannot deadlock.
- Every change writes an append-only ledger row in the same transaction
  (pattern 6): signed deltas, the resulting levels, a reason with a `CHECK`,
  the actor (without a foreign key, or with a label snapshot, so "who"
  survives the user's deletion) and the business reference (order,
  shipment). The ledger does not cascade from the tenant or the stock row.
- Links between the ledger's subjects pin everything that must agree: a
  reservation shipped by a shipment references `(organizationId, shipmentId,
  warehouseId, orderId)`, so it cannot be shipped by another order's parcel.
- One very hot row (a flash-sale item) serializes its buyers; the escape is
  splitting its stock into several bucket rows, not removing the guard.
