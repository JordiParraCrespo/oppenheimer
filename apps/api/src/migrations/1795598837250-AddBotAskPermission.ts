import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot's approval level gains a third value, the sessions' three
 * (`ask`, `auto`, `full`), and `auto` changes meaning (2026-11-25):
 *
 * - `ask` (Ask for approval) is what `auto` was until now: what stays inside
 *   Oppenheimer runs, what reaches outside asks on a card.
 * - `auto` (Approve for me) puts each call that would ask in front of a
 *   reviewer first, which lets it run or raises the card.
 * - `full` (Full access) never raises a card.
 *
 * So every bot stored at `auto` moves to `ask` and keeps exactly the
 * behaviour it had; none is loosened by the migration. The column default
 * stays `auto`: a bot made from now on starts at Approve for me, the
 * reviewer. `bot` is one row per bot, a handful per workspace, so the
 * backfill is one statement. `varchar(8)` already fits every value.
 *
 * The reviewer's completions are counted with the bot's other model calls
 * outside a turn, under a purpose of their own (`auto_review`), so
 * `/usage` says what Approve for me costs.
 *
 * `down()` puts `ask` back as `auto`, the behaviour it stands for under the
 * old meaning, and a reviewed `auto` bot stays `auto`, the stricter old
 * level of the two.
 */
export class AddBotAskPermission1795598837250 implements MigrationInterface {
  name = 'AddBotAskPermission1795598837250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot" DROP CONSTRAINT "CHK_bot_permission"`);
    await queryRunner.query(`UPDATE "bot" SET "permission" = 'ask' WHERE "permission" = 'auto'`);
    await queryRunner.query(
      `ALTER TABLE "bot" ADD CONSTRAINT "CHK_bot_permission" CHECK ("permission" IN ('ask', 'auto', 'full'))`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review', 'dream', 'suggestion', 'auto_review'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM bot_model_call WHERE purpose = 'auto_review'`);
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review', 'dream', 'suggestion'))`,
    );
    await queryRunner.query(`ALTER TABLE "bot" DROP CONSTRAINT "CHK_bot_permission"`);
    await queryRunner.query(`UPDATE "bot" SET "permission" = 'auto' WHERE "permission" = 'ask'`);
    await queryRunner.query(
      `ALTER TABLE "bot" ADD CONSTRAINT "CHK_bot_permission" CHECK ("permission" IN ('auto', 'full'))`,
    );
  }
}
