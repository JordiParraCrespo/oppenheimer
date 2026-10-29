import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot searches its own chat (`search_chat`, `product/versions/mvp/25-bots.md`
 * §4.1): what the person and the bot said, including what has folded into
 * the conversation's summary and is no longer in the turn's history.
 *
 * - `IDX_bot_message_search`: GIN over `to_tsvector('simple', "content")`,
 *   partial on the two roles that are searched (`user`, `assistant`).
 *   `simple` assumes no language, so a chat in Spanish matches as one in
 *   English does, word for word with no stemming. Activity lines and events
 *   are left out: their words are Oppenheimer's, not the conversation's.
 *
 * Access pattern and the index that serves it:
 *   Q1 a bot's messages whose words match, best first → IDX_bot_message_search,
 *      ANDed with IDX_bot_message_bot for the bot
 *
 * The query repeats the index's expression and predicate exactly, or the
 * planner cannot use it.
 */
export class AddBotMessageSearch1791004400000 implements MigrationInterface {
  name = 'AddBotMessageSearch1791004400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bot_message_search" ON "bot_message"
        USING GIN (to_tsvector('simple', "content"))
        WHERE "role" IN ('user', 'assistant')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bot_message_search"`);
  }
}
