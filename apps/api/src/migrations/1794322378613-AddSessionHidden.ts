import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A session can be hidden from the console's sidebar and shown again
 * (`product/next-steps/hidden-sessions.md`): a bot, a script or an agent
 * starts work the person need not watch, and the person shows it when they
 * want to.
 *
 * `work_session.hidden` is a column of the fold, written only by it from
 * `session.visibility_set`, like `name` from `session.named`. A boolean with a
 * default, so every existing row reads as shown and adding it rewrites no row.
 * No index: the console reads the whole list and filters in the browser, and
 * the API's list does not filter on it.
 */
export class AddSessionHidden1794322378613 implements MigrationInterface {
  name = 'AddSessionHidden1794322378613';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_session" ADD "hidden" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN "hidden"`);
  }
}
