import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots: the provider a new bot starts on (`25-bots.md` §2). The workspace
 * marks one of its stored keys as the default; with none marked, the first
 * with a key in `BOT_PROVIDER_PREFERENCE`, else Anthropic. The mark lives on the key's row, so removing the key
 * removes it too.
 *
 * At most one per workspace: `UQ_model_provider_credential_default`, a partial
 * unique index on the marked rows. A change of default clears the old mark
 * before setting the new one, in one transaction. The rows of a workspace are
 * four at most and read whole, so the index serves no read.
 */
export class AddModelProviderDefault1791002800000 implements MigrationInterface {
  name = 'AddModelProviderDefault1791002800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE model_provider_credential ADD COLUMN "markedDefault" boolean DEFAULT false NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_model_provider_credential_default" ON model_provider_credential USING btree ("organizationId") WHERE "markedDefault"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_model_provider_credential_default"`);
    await queryRunner.query(`ALTER TABLE model_provider_credential DROP COLUMN "markedDefault"`);
  }
}
