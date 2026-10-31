import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Codex cloud environment a session was started in, as the person picked
 * it (`product/next-steps/cloud-agents.md`, "Which Codex environment"). Folded
 * from `session.requested` like the rest of the launch, so a create sent again
 * after a reconnect starts the task in the same environment. Null is the host's
 * own pick: the environment linked to the repository. Adding a nullable column
 * with no default rewrites no rows and holds the table's lock only for the
 * catalog change.
 */
export class AddSessionLaunchEnvironment1791005700000 implements MigrationInterface {
  name = 'AddSessionLaunchEnvironment1791005700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_session" ADD COLUMN "launchEnvironment" varchar(128)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN "launchEnvironment"`);
  }
}
