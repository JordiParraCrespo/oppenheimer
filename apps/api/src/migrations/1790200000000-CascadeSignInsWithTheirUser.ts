import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Better Auth's `session` and `account` rows get the foreign key to `user`
 * they never had, `ON DELETE CASCADE`.
 *
 * Without it, deleting a user left its sign-ins and linked identities behind,
 * and deleting an account meant a second write to take them — two writes that
 * could land one without the other, a signed-out account that still exists.
 * With it, the user row and every sign-in go in the one statement. Better
 * Auth's own `deleteUser` removes them first anyway, so it is unaffected.
 *
 * Rows already orphaned by an earlier delete are removed first, or the
 * constraint could not be added.
 */
export class CascadeSignInsWithTheirUser1790200000000 implements MigrationInterface {
  name = 'CascadeSignInsWithTheirUser1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['session', 'account']) {
      await queryRunner.query(
        `DELETE FROM "${table}" t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = t."userId")`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_user"
           FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_userId" ON "${table}" ("userId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['account', 'session']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_user"`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_userId"`);
    }
  }
}
