import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { bootDataSourceFactory } from '../src/config/boot-migrations';
import { databaseConfigFromEnv, poolOptions } from '../src/config/database.config';
import { loadMigrations, runAllMigrations } from './run-migrations';

/**
 * Both Postgres pools fail fast instead of hanging: a slow statement, a held
 * row lock and a drained pool each surface as an error within the configured
 * limit. On a pool with `pg`'s defaults every one of these waits forever.
 *
 * Boot migrations are the exception, and are checked here too: they run on a
 * connection of their own, without the statement timeout.
 */
describe('database pool timeouts (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  const connect = async (database = 'test') => {
    const client = new Client({
      host: pgContainer.getHost(),
      port: pgContainer.getMappedPort(5432),
      user: 'test',
      password: 'test',
      database,
    });
    await client.connect();
    return client;
  };

  beforeAll(async () => {
    [pgContainer, redisContainer] = await Promise.all([
      new GenericContainer('postgres:16-alpine')
        .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start(),
      new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
    ]);

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = pgContainer.getHost();
    process.env.DB_PORT = pgContainer.getMappedPort(5432).toString();
    process.env.DB_USERNAME = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_DATABASE = 'test';
    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString();
    process.env.BETTER_AUTH_SECRET = 'integration-test-secret-value-32-chars';
    // Short limits, so a statement or a lock that is not cut off shows up as a
    // test timeout rather than a slow suite.
    process.env.DB_STATEMENT_TIMEOUT_MS = '1000';
    process.env.DB_LOCK_TIMEOUT_MS = '500';
    process.env.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS = '2000';

    await runAllMigrations();

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    await app.init();
    dataSource = moduleRef.get(DataSource);
  }, 180000);

  afterAll(async () => {
    await app?.close();
    const { emailQueue } = await import('../src/auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  it('tags the app pool and gives it the configured timeouts', async () => {
    const [settings] = await dataSource.query(
      `SELECT current_setting('application_name') AS "applicationName",
              current_setting('statement_timeout') AS "statementTimeout",
              current_setting('lock_timeout') AS "lockTimeout",
              current_setting('idle_in_transaction_session_timeout') AS "idleInTransaction"`,
    );

    expect(settings).toEqual({
      applicationName: 'api',
      statementTimeout: '1s',
      lockTimeout: '500ms',
      idleInTransaction: '2s',
    });
    expect(dataSource.options.extra).toMatchObject({ max: 10, connectionTimeoutMillis: 5_000 });
  });

  it('cancels a statement that runs past DB_STATEMENT_TIMEOUT_MS', async () => {
    await expect(dataSource.query('SELECT pg_sleep(2)')).rejects.toMatchObject({
      driverError: expect.objectContaining({ code: '57014' }),
    });
  });

  it('gives up on a row lock after DB_LOCK_TIMEOUT_MS instead of queueing behind it', async () => {
    const holder = await connect();
    try {
      await holder.query('CREATE TABLE lock_probe (id int PRIMARY KEY)');
      await holder.query('INSERT INTO lock_probe VALUES (1)');
      await holder.query('BEGIN');
      await holder.query('SELECT * FROM lock_probe WHERE id = 1 FOR UPDATE');

      const started = Date.now();
      await expect(
        dataSource.query('SELECT * FROM lock_probe WHERE id = 1 FOR UPDATE'),
      ).rejects.toMatchObject({ driverError: expect.objectContaining({ code: '55P03' }) });
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      await holder.query('ROLLBACK').catch(() => {});
      await holder.query('DROP TABLE IF EXISTS lock_probe');
      await holder.end();
    }
  });

  it('tags Better Auth’s pool separately in pg_stat_activity', async () => {
    // Any Better Auth call that reaches the database opens a client on its pool.
    const { auth } = await import('../src/auth/infrastructure/better-auth.config');
    await auth.api.getSession({ headers: new Headers() }).catch(() => undefined);
    await auth.api
      .signInEmail({ body: { email: 'nobody@example.com', password: 'not-a-password' } })
      .catch(() => undefined);

    const rows: { name: string }[] = await dataSource.query(
      `SELECT DISTINCT application_name AS name FROM pg_stat_activity WHERE datname = 'test'`,
    );
    expect(rows.map((row) => row.name)).toEqual(expect.arrayContaining(['api', 'api-auth']));
  });

  it('fails a query that waits longer than DB_CONNECTION_TIMEOUT_MS for a free client', async () => {
    // A pool of one, built from the same config the app reads.
    process.env.DB_POOL_MAX = '1';
    process.env.DB_CONNECTION_TIMEOUT_MS = '500';
    const small = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      extra: poolOptions(databaseConfigFromEnv(), 'api'),
    });
    await small.initialize();
    const runner = small.createQueryRunner();
    try {
      await runner.startTransaction();
      const started = Date.now();
      await expect(small.query('SELECT 1')).rejects.toThrow(
        /timeout exceeded when trying to connect/,
      );
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      await runner.rollbackTransaction().catch(() => {});
      await runner.release();
      await small.destroy();
      delete process.env.DB_POOL_MAX;
      delete process.env.DB_CONNECTION_TIMEOUT_MS;
    }
  });

  it('runs boot migrations on their own connection, free of the statement timeout', async () => {
    const admin = await connect();
    await admin.query('CREATE DATABASE boot');
    await admin.end();

    const migrations = await loadMigrations();
    const options = {
      type: 'postgres' as const,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'boot',
      migrations,
      migrationsRun: false,
      // The app pool's options, with the 1 s statement timeout set above: a
      // migration run under them would be cut off by the slow one below.
      extra: poolOptions(databaseConfigFromEnv(), 'api'),
    };
    // A last migration that takes longer than the request statement timeout,
    // and records which connection ran it.
    class SlowerThanARequest1999999999999 {
      name = 'SlowerThanARequest1999999999999';
      async up(queryRunner: { query: (sql: string) => Promise<unknown> }) {
        await queryRunner.query('SELECT pg_sleep(1.5)');
        await queryRunner.query(
          `CREATE TABLE migrated_by AS SELECT current_setting('application_name') AS name,
                  current_setting('statement_timeout') AS "statementTimeout"`,
        );
      }
      async down() {}
    }

    const app = await bootDataSourceFactory()({
      ...options,
      migrations: [...migrations, SlowerThanARequest1999999999999],
    });
    expect(app.isInitialized).toBe(false);

    const probe = await connect('boot');
    try {
      const { rows } = await probe.query('SELECT * FROM migrated_by');
      expect(rows).toEqual([{ name: 'api-migrations', statementTimeout: '0' }]);
      const { rows: pending } = await probe.query('SELECT count(*)::int AS n FROM migrations');
      expect(pending[0].n).toBe(migrations.length + 1);
    } finally {
      await probe.end();
    }
  });
});
