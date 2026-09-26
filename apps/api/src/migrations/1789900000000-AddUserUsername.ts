import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `user.username`: the handle Settings → Profile edits, which session logs
 * and commit trailers carry.
 *
 * Nullable: every account that exists has none, and one is never invented
 * for it — a handle somebody did not choose would be the first thing they
 * had to undo. Unique across accounts, since two people answering to one
 * handle in a commit trailer is the confusion it exists to prevent; the
 * constraint is the rule, the handler's lookup only makes the error kind.
 * The check mirrors `USERNAME_PATTERN` in `@oppenheimer/shared`, so a row
 * written around the API still cannot hold an uppercase or malformed handle
 * that would never compare equal to what the form sends.
 */
export class AddUserUsername1789900000000 implements MigrationInterface {
  name = 'AddUserUsername1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "username" character varying(39)`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_username" UNIQUE ("username")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "CHK_user_username"
         CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9](-?[a-z0-9])*$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "CHK_user_username"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_user_username"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "username"`);
  }
}
