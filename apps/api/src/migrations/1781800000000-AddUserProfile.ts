import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The caller's own account.
 *
 * `phone` and `jobTitle` join the Better-Auth-owned `user` row rather than a
 * side table: they are shown wherever the user is (the profile card, the team
 * directory), and Better Auth already carries them onto the session user via
 * `userAdditionalFields`, so a screen needs no second fetch to render them.
 */
export class AddUserProfile1781800000000 implements MigrationInterface {
  name = 'AddUserProfile1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "phone" character varying`);
    await queryRunner.query(`ALTER TABLE "user" ADD "jobTitle" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "jobTitle"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phone"`);
  }
}
