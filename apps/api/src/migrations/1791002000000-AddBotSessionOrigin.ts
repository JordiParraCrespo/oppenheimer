import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sessions a bot starts (`25-bots.md` §4.2): `work_session.origin` admits
 * `bot`. A bot acts as its owner, so the session is the owner's and its first
 * turn is theirs (`session_turn.origin` stays `person`); the origin is what
 * lets the console and a later audit tell the owner's own sessions from the
 * ones their bot started. Nothing else changes: no column, no index.
 */
export class AddBotSessionOrigin1791002000000 implements MigrationInterface {
  name = 'AddBotSessionOrigin1791002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_origin"`);
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_origin" CHECK (origin IN ('person', 'automation', 'review', 'bot'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE work_session SET origin = 'person' WHERE origin = 'bot'`);
    await queryRunner.query(`ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_origin"`);
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_origin" CHECK (origin IN ('person', 'automation', 'review'))`,
    );
  }
}
