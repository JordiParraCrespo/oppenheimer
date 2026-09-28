import type { DataSource, DataSourceOptions } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { bootDataSourceFactory, MIGRATOR_POOL_OPTIONS } from '../boot-migrations';

/**
 * Boot migrations run on a connection of their own, without the request-time
 * timeouts the app pool carries, and finish before the app DataSource exists.
 */

const APP_EXTRA = {
  max: 10,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  lock_timeout: 5_000,
  idle_in_transaction_session_timeout: 30_000,
  application_name: 'api',
};

function fakeDataSources() {
  const log: string[] = [];
  const created: DataSourceOptions[] = [];
  const create = (options: DataSourceOptions) => {
    const index = created.push(options) - 1;
    const name = index === 0 && options.extra === MIGRATOR_POOL_OPTIONS ? 'migrator' : 'app';
    log.push(`${name}:new`);
    return {
      initialize: async () => log.push(`${name}:initialize`),
      runMigrations: async () => log.push(`${name}:runMigrations`),
      destroy: async () => log.push(`${name}:destroy`),
    } as unknown as DataSource;
  };
  return { log, created, create };
}

const options = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'postgres',
    extra: APP_EXTRA,
    migrations: ['dist/migrations/*.js'],
    migrationsRun: false,
    ...overrides,
  }) as DataSourceOptions;

describe('bootDataSourceFactory', () => {
  it('migrates on a single timeout-free connection, then returns the app DataSource untouched', async () => {
    const { log, created, create } = fakeDataSources();

    await bootDataSourceFactory(create)(options());

    expect(log).toEqual([
      'migrator:new',
      'migrator:initialize',
      'migrator:runMigrations',
      'migrator:destroy',
      'app:new',
    ]);
    const [migrator, app] = created;
    expect(migrator.extra).toEqual({
      max: 1,
      connectionTimeoutMillis: 30_000,
      application_name: 'api-migrations',
    });
    expect(migrator.extra).not.toHaveProperty('statement_timeout');
    expect(migrator.extra).not.toHaveProperty('lock_timeout');
    expect(migrator.migrationsRun).toBe(false);
    expect(migrator.migrations).toEqual(['dist/migrations/*.js']);
    // `@nestjs/typeorm` initializes the app DataSource itself.
    expect(app.extra).toBe(APP_EXTRA);
  });

  it('closes the migrator even when a migration fails', async () => {
    const log: string[] = [];
    const create = () =>
      ({
        initialize: async () => log.push('initialize'),
        runMigrations: async () => {
          throw new Error('migration failed');
        },
        destroy: async () => log.push('destroy'),
      }) as unknown as DataSource;

    await expect(bootDataSourceFactory(create)(options())).rejects.toThrow('migration failed');
    expect(log).toEqual(['initialize', 'destroy']);
  });

  it('runs nothing under test, where the app lists no migrations', async () => {
    const { log, create } = fakeDataSources();

    await bootDataSourceFactory(create)(options({ migrations: [] }));

    expect(log).toEqual(['app:new']);
  });

  it('runs nothing for the OpenAPI build, which has no database', async () => {
    const { log, create } = fakeDataSources();

    await bootDataSourceFactory(create)(options({ manualInitialization: true }));

    expect(log).toEqual(['app:new']);
  });
});
