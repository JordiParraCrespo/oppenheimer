import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot turn gets one more origin, `check_back`: the look a bot asked for
 * with its `check_back` tool, at work it delegated or waits on. Only the
 * check changes; no row is rewritten. It is added `NOT VALID` and validated
 * in a statement of its own, so adding it does not scan the table; every row
 * already holds an origin the wider list allows.
 */
export class AddBotCheckBackOrigin1795477611257 implements MigrationInterface {
  name = 'AddBotCheckBackOrigin1795477611257';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram', 'whatsapp', 'slack', 'github', 'check_back')) NOT VALID`,
    );
    await queryRunner.query(`ALTER TABLE bot_turn VALIDATE CONSTRAINT "CHK_bot_turn_origin"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM bot_turn WHERE "origin" = 'check_back'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram', 'whatsapp', 'slack', 'github')) NOT VALID`,
    );
    await queryRunner.query(`ALTER TABLE bot_turn VALIDATE CONSTRAINT "CHK_bot_turn_origin"`);
  }
}
