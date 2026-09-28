import { DataSource, type DataSourceOptions } from 'typeorm';

/**
 * The connection boot migrations run on: one client, no statement or lock
 * timeout. A migration may legitimately run longer than any request should (a
 * backfill, a `CREATE INDEX` on a table that grew, `VALIDATE CONSTRAINT`), and
 * one that needs a lock timeout sets its own `SET LOCAL lock_timeout` and
 * `RESET`s it (see `HardenAuthTables`), which returns to this connection's
 * startup value: none.
 */
export const MIGRATOR_POOL_OPTIONS = {
  max: 1,
  connectionTimeoutMillis: 30_000,
  application_name: 'api-migrations',
};

/**
 * `dataSourceFactory` for `TypeOrmModule.forRootAsync`: runs pending
 * migrations on a separate, short-lived DataSource, then hands back the app's
 * own one for `@nestjs/typeorm` to initialize.
 *
 * The app DataSource carries the request-time timeouts in `extra`
 * (`poolOptions` in `database.config.ts`). Running migrations on it through
 * `migrationsRun` would put a deploy's migrations under the same statement
 * limit as a request, so the app DataSource sets `migrationsRun: false` and
 * this runs them instead.
 *
 * Nothing runs when the options list no migrations (the test runner) or ask
 * for `manualInitialization` (the OpenAPI build, which has no database).
 *
 * `createDataSource` is a seam for the unit test; the app passes nothing.
 */
export function bootDataSourceFactory(
  createDataSource: (options: DataSourceOptions) => DataSource = (options) =>
    new DataSource(options),
) {
  return async (options?: DataSourceOptions): Promise<DataSource> => {
    if (!options) throw new Error('TypeORM passed no options to the DataSource factory');

    // `migrations` may be a list or a map of them.
    const hasMigrations = Object.values(options.migrations ?? {}).length > 0;
    const manual = 'manualInitialization' in options && Boolean(options.manualInitialization);

    if (hasMigrations && !manual) {
      // The same options, entities and migrations as the app's DataSource —
      // TypeORM needs the entity metadata to build — but not its pool.
      const migrator = createDataSource({
        ...options,
        migrationsRun: false,
        extra: MIGRATOR_POOL_OPTIONS,
      } as DataSourceOptions);
      await migrator.initialize();
      try {
        // No `transaction` argument: the configured `migrationsTransactionMode`
        // (TypeORM's default, `all`) applies, exactly as `migrationsRun` did.
        await migrator.runMigrations();
      } finally {
        await migrator.destroy();
      }
    }

    // Left uninitialized: `@nestjs/typeorm` initializes it unless
    // `manualInitialization` is set.
    return createDataSource(options);
  };
}
