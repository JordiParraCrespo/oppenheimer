import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Steer (`product/next-steps/0.7-terminal-and-chat.md`): a message sent
 * while the bot works can go into the turn under way instead of waiting for
 * the next one, the way Codex's composer steers a running turn.
 *
 * `bot_turn."steer"` is the person's ask, kept on the queued turn their
 * message opens: the running turn of the same sender takes it at its next
 * tool call, moving the message into its own transcript and deleting the
 * queued turn in one transaction under the bot's lock (the lock a send, a
 * Stop and a turn's end take). A steer the running turn never reached stays
 * what it always was, a queued turn, and runs next: nothing is lost, and no
 * other column or status was needed for it.
 *
 * Lock-safe on a table with rows: a `boolean NOT NULL` with a constant
 * default is a catalog change (Postgres 11+), no rewrite and no scan. No
 * index: the take reads a bot's queued turns, which `IDX_bot_turn_active`
 * already serves, and they are a handful. No `CHECK` that only a message of
 * yours steers either: adding one validates every row under the lock this
 * boot holds to its end, so that rule is the domain's (`BotTurnEntity`).
 */
export class AddBotTurnSteer1791005730000 implements MigrationInterface {
  name = 'AddBotTurnSteer1791005730000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD COLUMN IF NOT EXISTS "steer" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN IF EXISTS "steer"`);
  }
}
