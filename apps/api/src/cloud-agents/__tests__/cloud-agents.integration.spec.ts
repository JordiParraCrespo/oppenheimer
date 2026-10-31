import { randomUUID } from 'node:crypto';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import { CloudAgentCredentialMapper } from '../cloud-agent-credential.mapper';
import { CloudAgentCredentialOrmEntity } from '../database/cloud-agent-credential.orm-entity';
import { CloudAgentCredentialRepository } from '../database/cloud-agent-credential.repository';
import { CloudAgentCredentialEntity } from '../domain/cloud-agent-credential.entity';

/**
 * A person's vendor keys against a real Postgres: one row per vendor that a
 * second key replaces, read and removed only by its owner, and gone with the
 * person. A cloud session itself is the sessions module's
 * (`sessions.integration.spec.ts`, "a cloud session").
 */
describe('cloud agents (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
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
      entities: [CloudAgentCredentialOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
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

  it('goes with the person whose key it is', async () => {
    const gone = await insertUser();
    await credentials.put(key(gone, 'cccc'));
    await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [gone]);
    expect((await credentials.findFor(organizationId, gone, 'cursor')).isNone()).toBe(true);
  });

  it('refuses a vendor the product does not know', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO cloud_agent_credential ("organizationId", "userId", provider, "sealedKey", "keyHint", "keyName")
         VALUES ($1, $2, 'devin', '\\x00', 'zzzz', 'Key')`,
        [organizationId, userId],
      ),
    ).rejects.toThrow(/CHK_cloud_agent_credential_provider/);
  });
});
