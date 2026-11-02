import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A version on `host`, for optimistic concurrency. Three writers change the
 * row: a person renaming it, a person unpairing it, and the machine itself
 * saying it was uninstalled. They were saved with TypeORM's `save`, which
 * writes every column the loaded copy holds, so a rename loaded before an
 * unpair wrote `unpairedAt = NULL` back and the machine was trusted again.
 * Every write now names the version it loaded (`writeVersioned` in
 * `@oppenheimer/backend-ddd`) and bumps it.
 *
 * `NOT NULL DEFAULT 1` is instant on a table with rows (Postgres 11+) and
 * gives every existing host the version a new one starts at. No index: the
 * version is only ever compared beside the primary key.
 */
export class AddHostVersion1793450648994 implements MigrationInterface {
  name = 'AddHostVersion1793450648994';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE host ADD COLUMN "version" integer NOT NULL DEFAULT 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE host DROP COLUMN "version"`);
  }
}
