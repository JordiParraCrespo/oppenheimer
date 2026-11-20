import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A session a bot started names that bot, so a routine can tell an event its
 * own bot's session caused (the pull request it opened as the owner, its
 * pushes, its checks) from a person's: `ownSessionGuard`.
 *
 * `work_session.botId` is nullable: only a `bot` session has one
 * (`CHK_work_session_bot`), and the bot sessions from before it was kept stay
 * null, since nothing recorded which bot it was. Deleting the bot clears it;
 * the session stays its owner's. The key carries the workspace, so a session
 * never names another workspace's bot. Adding a null column rewrites no row.
 *
 * The lookup goes from the event's repository and branch to the sessions on
 * it, a host session's checkout or a cloud session's run, so each gets that
 * index; `work_session.botId` gets one for the foreign key's `SET NULL`.
 */
export class AddWorkSessionBot1795193805274 implements MigrationInterface {
  name = 'AddWorkSessionBot1795193805274';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" ADD "botId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "work_session" ADD CONSTRAINT "CHK_work_session_bot" CHECK ("botId" IS NULL OR origin = 'bot')`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_session" ADD CONSTRAINT "FK_work_session_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE SET NULL ("botId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_session_bot" ON "work_session" ("organizationId", "botId") WHERE "botId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_checkout_repo_branch" ON "session_checkout" ("organizationId", "githubRepoId", branch)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_cloud_run_branch" ON "session_cloud_run" ("organizationId", branch) WHERE branch IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_session_cloud_run_branch"`);
    await queryRunner.query(`DROP INDEX "IDX_session_checkout_repo_branch"`);
    await queryRunner.query(`DROP INDEX "IDX_work_session_bot"`);
    await queryRunner.query(`ALTER TABLE "work_session" DROP CONSTRAINT "FK_work_session_bot"`);
    await queryRunner.query(`ALTER TABLE "work_session" DROP CONSTRAINT "CHK_work_session_bot"`);
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN "botId"`);
  }
}
