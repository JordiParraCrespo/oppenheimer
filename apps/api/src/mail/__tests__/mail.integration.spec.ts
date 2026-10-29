import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { GmailConnectionOrmEntity } from '../database/gmail-connection.orm-entity';
import { GmailConnectionRepository } from '../database/gmail-connection.repository';
import { GmailConnectionEntity } from '../domain/gmail-connection.entity';
import { GmailConnectionMapper } from '../gmail-connection.mapper';

/**
 * Mail's one table against a real Postgres, built by the migrations: a Gmail
 * connection is read only by its owner, even by a workspace owner who can
 * read every row of the workspace; one Google account is one row per person;
 * and the connection goes with the person.
 */
describe('mail (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let connections: GmailConnectionRepository;
  let organizationId: string;
  let ana: string;
  let ben: string;

  const scopeOf = (user: string, bypass = false): AccessScope => ({
    userId: user,
    organizationId,
    teamIds: [],
    grants: new Map(),
    bypass,
  });

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    process.env.DB_HOST = pg.getHost();
    process.env.DB_PORT = pg.getMappedPort(5432).toString();
    await runAllMigrations();
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [GmailConnectionOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    connections = new GmailConnectionRepository(
      dataSource.getRepository(GmailConnectionOrmEntity),
      new GmailConnectionMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
  });

  async function insertUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName") VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  beforeEach(async () => {
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    ana = await insertUser();
    ben = await insertUser();
  });

  const connection = (userId: string, googleSubject = 'sub-1') =>
    GmailConnectionEntity.connect({
      organizationId,
      userId,
      googleSubject,
      accountEmail: 'ana@gmail.test',
      label: 'Personal',
      refreshTokenSealed: Buffer.from('sealed'),
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    });

  it('reads a connection only for its owner, a workspace-wide reader included', async () => {
    const mine = connection(ana);
    await connections.insert(mine);

    await expect(connections.findAllOwn(scopeOf(ana))).resolves.toHaveLength(1);
    await expect(connections.findAllOwn(scopeOf(ben, true))).resolves.toEqual([]);
    expect((await connections.findOwnById(scopeOf(ben, true), mine.id)).isNone()).toBe(true);
  });

  it('keeps one row per Google account per person, and lets another person hold the same account', async () => {
    await connections.insert(connection(ana));

    await expect(connections.insert(connection(ana))).rejects.toThrow(
      /UQ_gmail_connection_user_account/,
    );
    await expect(connections.insert(connection(ben))).resolves.toBeUndefined();
  });

  it('writes a rename and a revoke, and the grant goes with the person', async () => {
    const mine = connection(ana);
    await connections.insert(mine);
    mine.rename('Work');
    await connections.save(mine);
    await connections.markRevoked(mine);

    const [read] = await connections.findAllOwn(scopeOf(ana));
    expect(read).toMatchObject({ label: 'Work', status: 'revoked' });

    await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [ana]);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM gmail_connection WHERE "userId" = $1`,
      [ana],
    );
    expect(count).toBe(0);
  });
});
