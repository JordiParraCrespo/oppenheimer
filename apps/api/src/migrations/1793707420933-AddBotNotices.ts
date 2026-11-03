import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot's latest line to the person (`notify`,
 * `product/next-steps/agent-tools.md` §5): one row per bot, which a new
 * notice overwrites under a new id, so the Inbox's mark on the last notice
 * (keyed by its id) never hides the next. `createdAt` is the bot's first
 * notice; `updatedAt` is when the current one came.
 *
 * The id is the notice's, not the row's: it is what the Inbox keys an item
 * by, which is why the table keeps a surrogate key rather than taking the
 * bot's id as its primary key, and why it changes on every upsert.
 *
 * Access patterns: the bot's row, by the upsert (`UQ_bot_notice_bot`, one
 * per bot, led by the tenant so it also backs the foreign key); the
 * workspace's notices, newest first, at most 50 (`GET /v1/bot-notices`, the
 * Inbox): `IDX_bot_notice_org_updated`, read backwards, `id` the tiebreaker.
 * The key references the bot on `("organizationId", id)`, so a notice cannot
 * point into another workspace, and goes with the bot. Bounded at one row
 * per bot: no retention plan needed.
 */
export class AddBotNotices1793707420933 implements MigrationInterface {
  name = 'AddBotNotices1793707420933';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_notice (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        text character varying(500) NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_notice" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_notice_text" CHECK (char_length(btrim(text)) > 0)
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_notice_bot" ON bot_notice ("organizationId", "botId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_notice_org_updated" ON bot_notice ("organizationId", "updatedAt", id)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_notice ADD CONSTRAINT "FK_bot_notice_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bot_notice`);
  }
}
