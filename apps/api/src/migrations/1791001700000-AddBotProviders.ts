import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots, slice 2 (`product/versions/mvp/25-bots.md` §2): who answers a bot.
 *
 * - `bot."provider"`: `anthropic`, `glm` or `openai`, which picks the engine a
 *   turn runs on. Every bot so far ran on Claude Code's models, so the default
 *   is `anthropic` and the existing `model` values stay valid. A `CHECK`, as
 *   the vocabulary is closed and every new provider is a new engine.
 * - `model_provider_credential`: a workspace's key for one provider, one row
 *   per workspace and provider (`UQ_model_provider_credential_provider`), the
 *   key sealed under `BOTS_PROVIDER_KEY` (`bytea`) with its last four
 *   characters beside it for the console. It goes with its workspace
 *   (`CASCADE`); the person who stored it only loses the link (`SET NULL`).
 *
 * Access patterns and the index that serves each:
 * - a workspace's keys (three at most), and its key for one provider:
 *   `UQ_model_provider_credential_provider`, which also backs
 *   `FK_model_provider_credential_organization`;
 * - an account's deletion nulling `updatedByUserId`:
 *   `IDX_model_provider_credential_updated_by`, partial on the rows that have one.
 */
export class AddBotProviders1791001700000 implements MigrationInterface {
  name = 'AddBotProviders1791001700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot ADD COLUMN "provider" character varying(16) DEFAULT 'anthropic' NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bot ADD CONSTRAINT "CHK_bot_provider" CHECK ("provider" IN ('anthropic', 'glm', 'openai'))`,
    );
    await queryRunner.query(
      `CREATE TABLE model_provider_credential (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "provider" character varying(16) NOT NULL,
        "sealedKey" bytea NOT NULL,
        "keyHint" character varying(4) NOT NULL,
        "updatedByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_model_provider_credential" PRIMARY KEY (id),
        CONSTRAINT "UQ_model_provider_credential_provider" UNIQUE ("organizationId", "provider"),
        CONSTRAINT "CHK_model_provider_credential_provider" CHECK ("provider" IN ('anthropic', 'glm', 'openai'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_model_provider_credential_updated_by" ON model_provider_credential USING btree ("updatedByUserId") WHERE ("updatedByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE model_provider_credential ADD CONSTRAINT "FK_model_provider_credential_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE model_provider_credential ADD CONSTRAINT "FK_model_provider_credential_updated_by" FOREIGN KEY ("updatedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE model_provider_credential`);
    await queryRunner.query(`ALTER TABLE bot DROP CONSTRAINT "CHK_bot_provider"`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "provider"`);
  }
}
