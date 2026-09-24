import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every point in time becomes `timestamptz` (#61).
 *
 * `timestamp without time zone` was TypeORM's default, so it was what every
 * date column got unless it said otherwise, and only six did. A value in such a
 * column goes out with no offset, the browser reads it as local time, and the
 * console was out by the reader's offset everywhere: a session created seconds
 * ago read two hours old in CEST.
 *
 * The values do not move. What is stored is already UTC (`now()` in a UTC
 * session, and the API runs in UTC), and `AT TIME ZONE 'UTC'` says so rather
 * than shifting anything: it reads each wall-clock value as the UTC instant it
 * always was.
 *
 * The columns are not listed here. A list would be a second copy of the
 * schema, true only on the day it was written; the migration asks the catalogue
 * for every `timestamp without time zone` column of every table and converts
 * those, one `ALTER TABLE` per table so each is rewritten once.
 *
 * `down` does nothing. Which columns were zoneless is exactly what this
 * migration erases, and putting them back would reinstate the bug. Code from
 * before it reads a `timestamptz` column unchanged: the driver returns a `Date`
 * either way.
 */
export class StoreTimestampsWithTimeZone1789300000000 implements MigrationInterface {
  name = 'StoreTimestampsWithTimeZone1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        target record;
      BEGIN
        FOR target IN
          SELECT c.table_name,
                 string_agg(
                   format(
                     'ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
                     c.column_name,
                     c.column_name
                   ),
                   ', ' ORDER BY c.column_name
                 ) AS alterations
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema AND t.table_name = c.table_name
           WHERE c.table_schema = current_schema()
             AND t.table_type = 'BASE TABLE'
             AND c.data_type = 'timestamp without time zone'
           GROUP BY c.table_name
        LOOP
          EXECUTE format('ALTER TABLE %I %s', target.table_name, target.alterations);
        END LOOP;
      END
      $$;
    `);
  }

  public async down(): Promise<void> {}
}
