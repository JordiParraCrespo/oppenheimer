import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The username rule as the database checks it. The same text as
 * `USERNAME_PATTERN.source` in `@oppenheimer/shared` — quoted rather than
 * imported, so this migration means tomorrow what it meant when it ran;
 * `users/__tests__/username.value-object.spec.ts` fails if the two differ.
 */
export const USERNAME_CHECK = '^[a-z0-9](-?[a-z0-9])*$';

/**
 * `user.username`: the handle Settings → Profile edits, which session logs
 * and commit trailers carry.
 *
 * Nullable: every account that exists has none, and one is never invented
 * for it. Unique across accounts under `UQ_user_username`, the name the
 * entity declares and the repository maps to USER_002.
 */
export class AddUserUsername1790100000000 implements MigrationInterface {
  name = 'AddUserUsername1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "username" character varying(39)`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_username" UNIQUE ("username")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "CHK_user_username"
         CHECK ("username" IS NULL OR "username" ~ '${USERNAME_CHECK}')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "CHK_user_username"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_user_username"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "username"`);
  }
}
