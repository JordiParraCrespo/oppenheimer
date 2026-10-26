import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The console sections a bot shows in, beside Employees
 * (`product/versions/mvp/28-bots-in-sections.md`).
 *
 * - `bot."sections"` is the set of sections (`sessions`, `automations`,
 *   `plan`, `pulls`) whose sidebar lists the bot under a Bots heading. It is
 *   read whole with the bot and never filtered on in SQL: the console reads
 *   the workspace's bots once and each sidebar keeps its own, so it needs no
 *   index.
 * - An array of `varchar(16)` with a `CHECK` that every element is a known
 *   section, the array form of the enum-like column; `'{}'` by default, so
 *   every existing bot shows in Employees only until its owner places it.
 * - A per-section join table was considered and not taken: four values, no
 *   order and no attributes of their own.
 */
export class AddBotSections1791003400000 implements MigrationInterface {
  name = 'AddBotSections1791003400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot ADD COLUMN "sections" character varying(16)[] DEFAULT '{}' NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bot ADD CONSTRAINT "CHK_bot_sections" CHECK ("sections" <@ ARRAY['sessions', 'automations', 'plan', 'pulls']::character varying(16)[])`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot DROP CONSTRAINT "CHK_bot_sections"`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "sections"`);
  }
}
