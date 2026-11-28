import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Model providers: more than one key per provider, and the next one taken when
 * a key runs out of credit. A workspace stores its keys for a provider in an
 * order (`position`), and a turn runs on the first that is not spent; a turn
 * the provider refused because the account behind the key is out of credit or
 * quota marks it (`spentAt`) and moves to the next. A spent key is tried again
 * only once every key of the provider is spent, the one spent longest ago
 * first, and its mark goes once a turn on it gets through.
 *
 * - `UQ_model_provider_credential_provider` goes: a provider now has a row per
 *   key. `IDX_model_provider_credential_order` takes its place, the read of a
 *   workspace's keys in order and the index behind
 *   `FK_model_provider_credential_organization`.
 * - `position` orders a provider's keys; two added at once may share one, and
 *   `createdAt` breaks the tie, so it carries no unique index. Existing rows
 *   are each their provider's only key, at 0.
 * - `markedDefault` stays on one row per workspace
 *   (`UQ_model_provider_credential_default`): the marked provider's first key.
 *   Removing that key moves the mark to the provider's next one.
 *
 * A smallint and a nullable timestamp with no default: added without a rewrite.
 */
export class AddModelProviderKeyFailover1795871743323 implements MigrationInterface {
  name = 'AddModelProviderKeyFailover1795871743323';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE model_provider_credential ADD COLUMN "position" smallint DEFAULT 0 NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE model_provider_credential ADD COLUMN "spentAt" timestamp with time zone`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_model_provider_credential_order" ON model_provider_credential USING btree ("organizationId", "provider", "position")`,
    );
    await queryRunner.query(
      `ALTER TABLE model_provider_credential DROP CONSTRAINT "UQ_model_provider_credential_provider"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Back to one key per provider: each keeps its first, and the mark with it.
    await queryRunner.query(
      `DELETE FROM model_provider_credential AS extra
        WHERE EXISTS (
          SELECT 1 FROM model_provider_credential AS earlier
           WHERE earlier."organizationId" = extra."organizationId"
             AND earlier."provider" = extra."provider"
             AND (earlier."position", earlier."createdAt", earlier.id)
               < (extra."position", extra."createdAt", extra.id)
        )`,
    );
    await queryRunner.query(
      `ALTER TABLE model_provider_credential ADD CONSTRAINT "UQ_model_provider_credential_provider" UNIQUE ("organizationId", "provider")`,
    );
    await queryRunner.query(`DROP INDEX "IDX_model_provider_credential_order"`);
    await queryRunner.query(`ALTER TABLE model_provider_credential DROP COLUMN "spentAt"`);
    await queryRunner.query(`ALTER TABLE model_provider_credential DROP COLUMN "position"`);
  }
}
