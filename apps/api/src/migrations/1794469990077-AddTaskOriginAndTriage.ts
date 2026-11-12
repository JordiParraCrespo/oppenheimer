import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who made a task, and whether its person has taken it up
 * (`product/versions/mvp/29-inbox.md`, "Tasks an agent made"). A task an
 * agent makes (a bot's plan tool, or a call on an API token or an OAuth grant,
 * which is how the MCP server and the CLI reach the API) waits in Plan's Inbox
 * until the person triages it: gives it a TODO day, starts or links a
 * session on it, or dismisses it.
 *
 * - `origin` `varchar(16)` with a `CHECK`, not a boolean: who made a row is a
 *   fact a later kind (an automation, an import) extends, and `person` /
 *   `agent` read in a query. `NOT NULL DEFAULT 'person'`, so every existing
 *   task reads as the person's, which is what each was until now.
 * - `triagedAt` `timestamptz`, nullable: null is "waiting on its person". A
 *   task the person made is triaged when it is made, so the backfill sets it
 *   to `createdAt` and `CHK_task_triage` holds that a person's task is never
 *   waiting. The time, not a boolean, says when it was taken up.
 * - No index. The Inbox reads the waiting tasks out of Plan's one read of the
 *   workspace's tasks, which `IDX_task_project` serves, as To do reads
 *   `focusDate`; nothing filters on these columns in SQL. A server-side list
 *   of waiting tasks would add `("organizationId", "createdAt") WHERE
 *   "triagedAt" IS NULL`.
 * - Nothing is logged for a triage: like planning a day, it is not a change
 *   Plan's log records (`23`, §4).
 * - The backfill is one `UPDATE` over `task`: nothing is deployed with data
 *   that matters yet (`database-design.md`, "While nothing is deployed").
 */
export class AddTaskOriginAndTriage1794469990077 implements MigrationInterface {
  name = 'AddTaskOriginAndTriage1794469990077';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "origin" varchar(16) NOT NULL DEFAULT 'person'`,
    );
    await queryRunner.query(`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "triagedAt" timestamptz`);
    await queryRunner.query(
      `UPDATE "task" SET "triagedAt" = "createdAt" WHERE "triagedAt" IS NULL AND "origin" = 'person'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task" ADD CONSTRAINT "CHK_task_origin" CHECK ("origin" IN ('person', 'agent'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "task" ADD CONSTRAINT "CHK_task_triage" CHECK ("origin" = 'agent' OR "triagedAt" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "CHK_task_triage"`);
    await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "CHK_task_origin"`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "triagedAt"`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "origin"`);
  }
}
