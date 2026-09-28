import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `automation_settings."headlessRunsPerHost"` becomes `"liveRunsPerHost"`.
 * The cap counts automation runs whose first turn has not ended, of either
 * drive, not headless turns only (16 §Q16, 2026-09-28), and its name says so.
 * A rename is catalog-only, and `CHK_automation_settings_positive` follows
 * the column.
 */
export class RenameAutomationHostCap1790700100000 implements MigrationInterface {
  name = 'RenameAutomationHostCap1790700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "automation_settings" RENAME COLUMN "headlessRunsPerHost" TO "liveRunsPerHost"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "automation_settings" RENAME COLUMN "liveRunsPerHost" TO "headlessRunsPerHost"`,
    );
  }
}
