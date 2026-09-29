import type { MigrationInterface, QueryRunner } from 'typeorm';
import { EXTENSIONS, SLICES } from './initial-schema';
import { seedSystemRoles } from './initial-schema/seed';

/**
 * The schema as it stood before the first deployment, in one migration.
 *
 * The SQL lives in `initial-schema/`, one file per module that owns the
 * tables (`sessions.ts` holds `work_session` and its neighbours), so a table
 * reads next to its keys and indexes. Why a table is shaped the way it is
 * lives with its ORM entity. The seed is the global system roles, from
 * `SYSTEM_ROLE_PERMISSIONS`.
 *
 * A change from here on is a new migration after this one, with its own
 * header; this file and `initial-schema/` do not grow.
 */
export class InitialSchema1790900000000 implements MigrationInterface {
  name = 'InitialSchema1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of EXTENSIONS) await queryRunner.query(statement);
    for (const slice of SLICES) {
      for (const statement of Object.values(slice.tables).flat())
        await queryRunner.query(statement);
    }
    for (const slice of SLICES) {
      for (const statement of slice.foreignKeys) await queryRunner.query(statement);
    }
    await seedSystemRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = SLICES.flatMap((slice) => Object.keys(slice.tables));
    await queryRunner.query(`DROP TABLE ${tables.map((table) => `"${table}"`).join(', ')} CASCADE`);
    await queryRunner.query('DROP EXTENSION IF EXISTS pg_trgm');
  }
}
