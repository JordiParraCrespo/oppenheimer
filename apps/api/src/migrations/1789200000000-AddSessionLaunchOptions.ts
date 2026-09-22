import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The launch options a session was started with: the model, the permission level
 * and the effort the composer's foot row was set to.
 *
 * Three columns rather than one JSON value, because each is a closed union and a
 * union is what a `varchar` column is for here (`.agents/rules/typeorm.md`). They
 * are **projections**, like every other column on `work_session`: the fold writes
 * them from the `session.requested` entry that states them, and a replay of any
 * log rebuilds them exactly.
 *
 * They are columns at all — rather than the log alone, as
 * `10-api-modules-and-data-model.md` first decided for `model` — because a restart
 * has to relaunch a session the way it was launched, the console shows the engine
 * button on a session that already exists, and New session seeds from the last
 * choice. Three per-row readers, and none of them can walk a log
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * No backfill. A row written before this existed was launched with no model, no
 * effort and the level that asks before every action, which is exactly what the
 * default writes — so `ask` here is a statement of fact rather than a placeholder.
 */
export class AddSessionLaunchOptions1789200000000 implements MigrationInterface {
  name = 'AddSessionLaunchOptions1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_session" ADD COLUMN IF NOT EXISTS "launchModel" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_session" ADD COLUMN IF NOT EXISTS "launchPermission" character varying NOT NULL DEFAULT 'ask'`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_session" ADD COLUMN IF NOT EXISTS "launchEffort" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN IF EXISTS "launchEffort"`);
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN IF EXISTS "launchPermission"`);
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN IF EXISTS "launchModel"`);
  }
}
