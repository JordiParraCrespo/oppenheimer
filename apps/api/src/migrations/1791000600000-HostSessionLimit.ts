import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How many sessions a host may run at once, as its owner set it. Null is the
 * default derived from the machine's size, so every existing host keeps
 * working without a backfill and gets a limit from what its runner reported.
 * A nullable column with no default is a catalog-only change: no rewrite, no
 * long lock on `host`.
 */
export class HostSessionLimit1791000600000 implements MigrationInterface {
  name = 'HostSessionLimit1791000600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE host ADD COLUMN "maxSessions" smallint');
    await queryRunner.query(
      'ALTER TABLE host ADD CONSTRAINT "CHK_host_maxSessions" CHECK ("maxSessions" BETWEEN 1 AND 64) NOT VALID',
    );
    await queryRunner.query('ALTER TABLE host VALIDATE CONSTRAINT "CHK_host_maxSessions"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE host DROP CONSTRAINT "CHK_host_maxSessions"');
    await queryRunner.query('ALTER TABLE host DROP COLUMN "maxSessions"');
  }
}
