import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Claude Code cloud session a worktree session continues (`claude
 * --teleport <id>`, `product/next-steps/cloud-agents.md`, "Bring it here").
 * Folded from `session.requested` like the rest of the launch, so a create
 * sent again after a reconnect continues the same cloud session rather than
 * starting an empty conversation. Null for every other session. Adding a
 * nullable column with no default rewrites no rows and holds the table's lock
 * only for the catalog change.
 */
export class AddSessionLaunchTeleport1793709681059 implements MigrationInterface {
  name = 'AddSessionLaunchTeleport1793709681059';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" ADD COLUMN "launchTeleport" varchar(80)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN "launchTeleport"`);
  }
}
