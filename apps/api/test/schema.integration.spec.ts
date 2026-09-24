import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from './run-migrations';

/**
 * Rules the schema holds as a whole, checked on the schema the migration chain
 * builds — not on the entities, which are one of several things that write it.
 * A migration's raw SQL and the outbox's `EntitySchema` land in the same
 * catalogue, so this is the only place that sees all of them at once.
 */
describe('the migrated schema (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();

    process.env.DB_HOST = pgContainer.getHost();
    process.env.DB_PORT = pgContainer.getMappedPort(5432).toString();
    process.env.DB_USERNAME = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_DATABASE = 'test';
    await runAllMigrations();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
    });
    await dataSource.initialize();
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  // A zoneless value reaches a client with no offset and is read as local time,
  // so every date would be out by the reader's offset (#61).
  it('stores every point in time as timestamptz', async () => {
    const zoneless = await dataSource.query(
      `SELECT table_name || '.' || column_name AS "column"
         FROM information_schema.columns
        WHERE table_schema = current_schema() AND data_type = 'timestamp without time zone'
        ORDER BY 1`,
    );
    expect(zoneless).toEqual([]);
  });
});
