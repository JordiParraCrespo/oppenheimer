import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { CloudAgentMapper } from '../cloud-agent.mapper';
import { CloudAgentCredentialMapper } from '../cloud-agent-credential.mapper';
import { CloudAgentOrmEntity } from '../database/cloud-agent.orm-entity';
import { CloudAgentRepository } from '../database/cloud-agent.repository';
import { CloudAgentCredentialOrmEntity } from '../database/cloud-agent-credential.orm-entity';
import { CloudAgentCredentialRepository } from '../database/cloud-agent-credential.repository';
import { CloudAgentEntity } from '../domain/cloud-agent.entity';
import { CloudAgentCredentialEntity } from '../domain/cloud-agent-credential.entity';

/**
 * Cloud agents against a real Postgres: a person's vendor key is one row per
 * vendor that a second key replaces, an agent and a key are read only by
 * their owner, the list is the owner's newest first, and a sync is written
 * back whole. The migration's checks hold what the code cannot be trusted to.
 */
describe('cloud agents (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let agents: CloudAgentRepository;
  let credentials: CloudAgentCredentialRepository;
  let organizationId: string;
  let userId: string;

  const scopeOf = (user: string): AccessScope => ({
    userId: user,
    organizationId,
    teamIds: [],
    grants: new Map(),
    bypass: false,
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
      entities: [CloudAgentOrmEntity, CloudAgentCredentialOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    agents = new CloudAgentRepository(
      dataSource.getRepository(CloudAgentOrmEntity),
      new CloudAgentMapper(),
    );
    credentials = new CloudAgentCredentialRepository(
      dataSource.getRepository(CloudAgentCredentialOrmEntity),
      new CloudAgentCredentialMapper(),
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
    userId = await insertUser();
  });

  const key = (user: string, hint: string) =>
    CloudAgentCredentialEntity.connect({
      organizationId,
      userId: user,
      provider: 'cursor',
      sealedKey: Buffer.from(`sealed-${hint}`),
      keyHint: hint,
      keyName: `Key ${hint}`,
      accountEmail: 'ana@example.com',
      accountId: '184',
    });

  const agent = (user: string, createdAt?: Date) => {
    const id = CloudAgentEntity.newId();
    const entity = CloudAgentEntity.launched(
      {
        id,
        organizationId,
        createdByUserId: user,
        provider: 'cursor',
        prompt: 'Fix the login page',
        repositoryUrl: 'https://github.com/acme/api',
        startingRef: null,
        model: 'grok-4.7',
        autoCreatePr: false,
        externalId: `bc-${id}`,
        url: `https://cursor.com/agents/bc-${id}`,
        name: 'Fix the login page',
        run: {
          runId: 'run-1',
          status: 'starting',
          branch: null,
          pullRequestUrl: null,
          summary: null,
        },
      },
      createdAt ?? new Date(),
    );
    return entity;
  };

  it('keeps one key per person and vendor, a second replacing the first', async () => {
    await credentials.put(key(userId, 'aaaa'));
    await credentials.put(key(userId, 'bbbb'));

    const own = await credentials.findAllOwn(scopeOf(userId));
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ keyHint: 'bbbb', keyName: 'Key bbbb' });
    expect(own[0].sealedKey.toString()).toBe('sealed-bbbb');
  });

  it('lets nobody else in the workspace read or remove a person’s key', async () => {
    const colleague = await insertUser();
    await credentials.put(key(userId, 'aaaa'));

    expect(await credentials.findAllOwn(scopeOf(colleague))).toEqual([]);
    expect(await credentials.deleteOwn(scopeOf(colleague), 'cursor')).toBe(false);
    expect((await credentials.findFor(organizationId, userId, 'cursor')).isSome()).toBe(true);
    expect(await credentials.deleteOwn(scopeOf(userId), 'cursor')).toBe(true);
    expect((await credentials.findFor(organizationId, userId, 'cursor')).isNone()).toBe(true);
  });

  it('lists a person’s own agents newest first, and someone else’s is not found', async () => {
    const colleague = await insertUser();
    const older = agent(userId);
    const newer = agent(userId);
    await agents.insert(older);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await agents.insert(newer);
    await agents.insert(agent(colleague));

    const listed = await agents.findOwn(scopeOf(userId));
    expect(listed.map((row) => row.id)).toEqual([newer.id, older.id]);
    expect((await agents.findOwnById(scopeOf(colleague), older.id)).isNone()).toBe(true);
  });

  it('writes a sync back whole and keeps it on a second read', async () => {
    const launched = agent(userId);
    await agents.insert(launched);
    const loaded = (await agents.findOwnById(scopeOf(userId), launched.id)).unwrap();
    const now = new Date('2026-10-26T12:00:00Z');
    loaded.sync(
      {
        runId: 'run-1',
        status: 'finished',
        branch: 'cursor/fix-login',
        pullRequestUrl: 'https://github.com/acme/api/pull/7',
        summary: 'Done.',
      },
      now,
    );
    expect(await agents.saveIfRun(loaded, 'run-1')).toBe(true);

    const again = (await agents.findOwnById(scopeOf(userId), launched.id)).unwrap();
    expect(again).toMatchObject({
      status: 'finished',
      branch: 'cursor/fix-login',
      pullRequestUrl: 'https://github.com/acme/api/pull/7',
      summary: 'Done.',
      model: 'grok-4.7',
    });
    expect(again.syncedAt).toEqual(now);
  });

  it('drops a sync that read the run before a follow-up, keeping the newer run', async () => {
    const launched = agent(userId);
    await agents.insert(launched);
    const syncing = (await agents.findOwnById(scopeOf(userId), launched.id)).unwrap();
    const following = (await agents.findOwnById(scopeOf(userId), launched.id)).unwrap();

    following.followedUp('run-2', new Date('2026-10-26T12:00:00Z'));
    expect(await agents.saveIfRun(following, 'run-1')).toBe(true);
    syncing.sync(
      { runId: 'run-1', status: 'finished', branch: null, pullRequestUrl: null, summary: 'Done.' },
      new Date('2026-10-26T12:00:01Z'),
    );
    expect(await agents.saveIfRun(syncing, 'run-1')).toBe(false);

    const again = (await agents.findOwnById(scopeOf(userId), launched.id)).unwrap();
    expect(again).toMatchObject({ latestRunId: 'run-2', status: 'starting', summary: null });
  });

  it('refuses a status or a vendor the product does not know, and a second row for one vendor agent', async () => {
    const launched = agent(userId);
    await agents.insert(launched);
    await expect(
      dataSource.query(`UPDATE cloud_agent SET status = 'paused' WHERE id = $1`, [launched.id]),
    ).rejects.toThrow(/CHK_cloud_agent_status/);
    await expect(
      dataSource.query(`UPDATE cloud_agent SET provider = 'devin' WHERE id = $1`, [launched.id]),
    ).rejects.toThrow(/CHK_cloud_agent_provider/);
    const twin = agent(userId);
    (twin as unknown as { props: { externalId: string } }).props.externalId = launched.externalId;
    await expect(agents.insert(twin)).rejects.toThrow(/UQ_cloud_agent_external/);
  });

  it('goes with the person who launched it', async () => {
    const gone = await insertUser();
    await agents.insert(agent(gone));
    await credentials.put(key(gone, 'cccc'));
    await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [gone]);
    const [{ count }] = await dataSource.query(
      `SELECT (SELECT count(*) FROM cloud_agent WHERE "createdByUserId" = $1)
            + (SELECT count(*) FROM cloud_agent_credential WHERE "userId" = $1) AS count`,
      [gone],
    );
    expect(Number(count)).toBe(0);
  });
});
