import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot's memory gets a tier and a scope (`product/versions/mvp/25-bots.md`
 * §4.1; from Grok Bot's memory, `research/lessons-from-grok-bot.md` §9 row 11).
 *
 * - `tier`: `profile` is in mind in every turn, `log` waits for `recall`.
 *   Every fact kept so far was in every prompt, so it starts `profile`.
 * - `scope`: `bot`, for this bot alone; `person`, a fact about the bot's
 *   owner that every bot of theirs in the workspace reads too. The row stays
 *   the bot's that learned it (who said so, and its cap), and goes with it.
 *   No second table: the facts are the same thing read more widely, and the
 *   bot's cap, its lock and its Settings page hold for both.
 *
 * Access patterns: a bot's own facts, `IDX_bot_memory_fact_bot`; a turn's
 * shared facts, the `person` facts of its owner's bots, read by the bots'
 * ids through `IDX_bot_memory_fact_person`, which holds only those rows.
 */
export class AddMemoryTiersAndScopes1791005000000 implements MigrationInterface {
  name = 'AddMemoryTiersAndScopes1791005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_memory_fact
        ADD COLUMN tier character varying(8) DEFAULT 'profile' NOT NULL,
        ADD COLUMN scope character varying(8) DEFAULT 'bot' NOT NULL,
        ADD CONSTRAINT "CHK_bot_memory_fact_tier" CHECK (tier IN ('profile', 'log')),
        ADD CONSTRAINT "CHK_bot_memory_fact_scope" CHECK (scope IN ('bot', 'person'))
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_memory_fact_person" ON bot_memory_fact ("organizationId", "botId", "createdAt", id) WHERE scope = 'person'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bot_memory_fact_person"`);
    await queryRunner.query(`
      ALTER TABLE bot_memory_fact
        DROP CONSTRAINT "CHK_bot_memory_fact_scope",
        DROP CONSTRAINT "CHK_bot_memory_fact_tier",
        DROP COLUMN scope,
        DROP COLUMN tier
    `);
  }
}
