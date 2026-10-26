import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a person did to an occurrence of an Inbox item
 * (`product/versions/mvp/28-inbox.md` §3). The items themselves are not
 * stored: an item is there while its source says it needs you. A mark is
 * keyed by the item and the wait it answers (`"itemKey"`), so a new wait
 * comes back however the last one was marked.
 *
 * - One row per person, workspace and occurrence (`UQ_inbox_mark_item`); a
 *   mark is changed in place, an upsert on that key, and removed (Bring back,
 *   Restore priority) by deleting the row: nothing reads a removed mark, so
 *   there is no soft delete.
 * - `"userId"` because a mark is a person's, ready for shared workspaces.
 *   Both foreign keys cascade: a mark means nothing without its workspace or
 *   its person. There is no composite key to `member`: a mark left behind by
 *   someone who left the workspace is never read (every read names the
 *   caller) and goes with the account or the workspace.
 * - `"itemKey"` names a row in another table (a session, an approval, a pull
 *   request at a commit, a run) by kind, so it has no foreign key: a mark
 *   whose source is gone is simply never matched.
 * - `"until"` is a snooze's end and only a snooze's (`CHK_inbox_mark_until`).
 *   A snooze whose end has passed is left out by the read, not rewritten.
 *
 * Access patterns:
 *   Q1 the caller's marks in the workspace (GET) → UQ_inbox_mark_item's prefix, or
 *      IDX_inbox_mark_user; newest changed first is a sort in memory, over
 *      one person's marks in one workspace (checked with EXPLAIN)
 *   Q2 one mark by key (PUT's upsert, DELETE)    → UQ_inbox_mark_item
 *   Q3 a user's delete cascading                 → IDX_inbox_mark_user
 *
 * Retention: rows only grow while their sources move on. A nightly sweep of
 * marks older than 30 days (28 §3) is planned and not built yet; until then
 * the read is bounded by its limit.
 */
export class AddInboxMarks1791003700000 implements MigrationInterface {
  name = 'AddInboxMarks1791003700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inbox_mark (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "itemKey" varchar(200) NOT NULL,
        mark varchar(16) NOT NULL,
        "until" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inbox_mark" PRIMARY KEY (id),
        CONSTRAINT "CHK_inbox_mark_mark" CHECK (mark IN ('done', 'low', 'snoozed', 'deleted')),
        CONSTRAINT "CHK_inbox_mark_item_key" CHECK (char_length("itemKey") > 0),
        CONSTRAINT "CHK_inbox_mark_until" CHECK ((mark = 'snoozed') = ("until" IS NOT NULL) AND ("until" IS NULL OR isfinite("until"))),
        CONSTRAINT "FK_inbox_mark_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE,
        CONSTRAINT "FK_inbox_mark_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
      )
    `);
    // Q1, Q2; also backs FK_inbox_mark_organization.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_inbox_mark_item" ON inbox_mark ("organizationId", "userId", "itemKey")`,
    );
    // Q3: backs FK_inbox_mark_user.
    await queryRunner.query(`CREATE INDEX "IDX_inbox_mark_user" ON inbox_mark ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_inbox_mark_user"`);
    await queryRunner.query(`DROP INDEX "UQ_inbox_mark_item"`);
    await queryRunner.query(`DROP TABLE inbox_mark`);
  }
}
