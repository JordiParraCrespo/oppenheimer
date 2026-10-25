import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots: the session an approved call started (`25-bots.md` §5).
 *
 * An approved `start_session` answered only in words, and the chat had to
 * read the session's id back off them to link to it. The call now says
 * which session it started as data, and the approval keeps it beside its
 * `result`: `"sessionId"`, null for a call that started none (any other
 * tool, one that failed, one not run yet). The event that reports the yes
 * back to the chat carries the same id, so the line links to the session.
 *
 * - Composite on `("organizationId", "sessionId")`, so an approval never
 *   points into another workspace's session.
 * - `SET NULL ("sessionId")`: the approval outlives its session and only
 *   loses the link.
 * - `IDX_bot_approval_session` (partial: most approvals start nothing)
 *   backs the foreign key, for a session's deletion. Nothing else reads by it.
 */
export class AddBotApprovalSession1791002900000 implements MigrationInterface {
  name = 'AddBotApprovalSession1791002900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_approval ADD COLUMN "sessionId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_approval_session" ON bot_approval ("organizationId", "sessionId") WHERE ("sessionId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD CONSTRAINT "FK_bot_approval_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE SET NULL ("sessionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_approval DROP CONSTRAINT "FK_bot_approval_session"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_approval_session"`);
    await queryRunner.query(`ALTER TABLE bot_approval DROP COLUMN "sessionId"`);
  }
}
