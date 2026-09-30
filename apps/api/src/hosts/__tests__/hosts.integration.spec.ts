import { createHash, generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { runAllMigrations } from '../../__tests__/run-migrations';
import type { HostPresencePort } from '../application/host-presence.port';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { HOST_METADATA_REPOSITORY, HOST_PRESENCE } from '../hosts.di-tokens';

/**
 * Pairing, against a real Postgres and Redis, for two properties only the database
 * has:
 *
 *  - **redemption is single-use under concurrency**: two requests presenting one
 *    secret at once produce one host and one refusal. The rule is a single
 *    `UPDATE … WHERE … RETURNING`, so only two real connections racing tests it.
 *  - **the default role grants `manage Host`**: a live database's roles are rows the
 *    migrations wrote, not the fallback constant, and a missing rule is a 403 on
 *    every host route that a stubbed ability would never notice.
 *
 * The schema is built by the migrations, not `synchronize`, so a bad migration fails
 * here.
 */
describe('Hosts & pairing (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  /** Signed-in owner of the hosts under test. */
  let user: { id: string; email: string; sessionToken: string };

  /** The control plane's own key, so `fingerprint` in a response is checkable. */
  const controlPlane = generateKeyPairSync('ed25519');

  beforeAll(async () => {
    [pgContainer, redisContainer] = await Promise.all([
      new GenericContainer('postgres:16-alpine')
        .withEnvironment({
          POSTGRES_USER: 'test',
          POSTGRES_PASSWORD: 'test',
          POSTGRES_DB: 'test',
        })
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

    // Without the key, the release base and the installer, minting and
    // registering answer HOSTS_004 and no machine can pair.
    process.env.CONTROL_PLANE_SIGNING_KEY = controlPlane.privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64');
    process.env.RUNNER_RELEASE_BASE_URL = 'https://releases.example.test';
    process.env.RUNNER_INSTALL_URL = 'https://releases.example.test/install.sh';
    process.env.RUNNER_RELEASE_CHANNEL = 'stable';

    await runAllMigrations();

    const { AppModule } = await import('../../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });

    // Mirror `main.ts`: the global prefix, URI versioning and the pipes are part
    // of the pipeline these tests exercise.
    const { VersioningType } = await import('@nestjs/common');
    const { SanitizePipe } = await import('@oppenheimer/backend-core');
    const { ZodValidationPipe } = await import('nestjs-zod');

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    dataSource = moduleRef.get(DataSource);

    user = await signUp('host-owner@example.com');
  }, 180000);

  afterAll(async () => {
    await app?.close();
    const { emailQueue } = await import('../../auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  interface CallOptions {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }

  async function call(path: string, options: CallOptions = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    return {
      status: response.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
    };
  }

  async function signUp(email: string) {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Integration-test-password-1',
        name: 'Host Owner',
        firstName: 'Host',
        lastName: 'Owner',
      }),
    });

    expect(response.ok).toBe(true);
    const sessionToken = response.headers.get('set-auth-token');
    expect(sessionToken).toBeTruthy();

    const payload = (await response.json()) as { user: { id: string; email: string } };
    return {
      id: payload.user.id,
      email: payload.user.email,
      sessionToken: sessionToken as string,
    };
  }

  /** Mint a pairing token and pull its secret out of the install command. */
  async function mintPairingToken(name = 'Dev box') {
    const created = await call('/api/v1/hosts/pairing', {
      method: 'POST',
      token: user.sessionToken,
      body: { name },
    });

    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const installCommand = created.body?.installCommand as string;
    const secret = /OPPENHEIMER_REGISTRATION_TOKEN=(\S+)/.exec(installCommand)?.[1] as string;
    expect(secret).toMatch(/^opr_reg_/);

    return { id: created.body?.id as string, secret, body: created.body };
  }

  /** A machine's keypair, encoded the way the runner encodes it. */
  function hostKey() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
    return {
      privateKey,
      base64: raw.toString('base64'),
      fingerprint: createHash('sha256').update(raw).digest('hex'),
    };
  }

  /**
   * The document `apps/runner/internal/host/domain.Facts` marshals — the shared
   * schema takes that struct verbatim, so this is the payload a real
   * `runner register` sends, not an API-shaped approximation of it.
   */
  const FACTS = {
    platform: 'macos',
    osVersion: '15.2',
    arch: 'arm64',
    hostname: 'devbox.local',
    user: 'jordi',
    home: '/Users/jordi',
    root: false,
    tools: [
      { name: 'git', path: '/usr/bin/git', version: '2.51.0', required: true },
      { name: 'tmux', path: '/opt/homebrew/bin/tmux', version: '3.5a', required: true },
      { name: 'claude', required: false },
    ],
    workspacePath: '/Users/jordi/oppenheimer-ai',
    diskFreeBytes: 214_748_364_800,
    runnerVersion: '0.3.1',
  };

  function register(secret: string, key: ReturnType<typeof hostKey>, name = 'detected-name') {
    return call('/api/v1/hosts/register', {
      method: 'POST',
      body: { token: secret, name, publicKey: key.base64, facts: FACTS },
    });
  }

  /** The boot assertion the runner signs on every dial. */
  function bootAssertion(privateKey: KeyObject, hostId: string, jti = randomJti()) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: hostId,
        sub: hostId,
        // With no `CONTROL_PLANE_URL` set, the control plane URL is `BETTER_AUTH_URL`.
        aud: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
        jti,
        iat: now,
        exp: now + 300,
      }),
    ).toString('base64url');
    const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey);
    return `${header}.${payload}.${signature.toString('base64url')}`;
  }

  function randomJti(): string {
    return createHash('sha256').update(`${Math.random()}`).digest('hex').slice(0, 32);
  }

  describe('migration', () => {
    it('creates the host table with no organization column', async () => {
      const columns: { column_name: string; data_type: string; is_nullable: string }[] =
        await dataSource.query(
          `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns WHERE table_name = 'host'`,
        );
      const byName = new Map(columns.map((column) => [column.column_name, column]));

      // The absence is the assertion: a host belongs to a person, and a tenant
      // column here would make the same laptop invisible from a second workspace.
      expect(byName.has('organizationId')).toBe(false);
      expect(byName.get('ownerUserId')?.is_nullable).toBe('NO');
      expect(byName.get('capabilities')?.data_type).toBe('jsonb');
      expect(byName.get('publicKey')?.data_type).toBe('text');
      expect(byName.get('unpairedAt')?.is_nullable).toBe('YES');

      // No rotation columns yet: nothing in this slice can write a retired key,
      // and three nullable fields with no writer are harder to explain than
      // adding them when the link can carry a rotation.
      expect(byName.has('previousPublicKey')).toBe(false);
      expect(byName.has('previousPublicKeyFingerprint')).toBe(false);
      expect(byName.has('previousPublicKeyExpiresAt')).toBe(false);
    });

    it('names the token’s owner column the same as the host’s', async () => {
      const columns: { column_name: string }[] = await dataSource.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'host_pairing_token'`,
      );
      const names = columns.map((column) => column.column_name);

      expect(names).toContain('ownerUserId');
      expect(names).not.toContain('createdByUserId');
    });

    it('stores both pairing source addresses as inet', async () => {
      const columns: { column_name: string; data_type: string }[] = await dataSource.query(
        `SELECT column_name, data_type
           FROM information_schema.columns WHERE table_name = 'host_pairing_token'`,
      );
      const byName = new Map(columns.map((column) => [column.column_name, column.data_type]));

      expect(byName.get('createdFromIp')).toBe('inet');
      expect(byName.get('redeemedFromIp')).toBe('inet');
    });

    it('makes the token digest unique, so one secret cannot be stored twice', async () => {
      const indexes: { indexdef: string }[] = await dataSource.query(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'host_pairing_token'`,
      );
      expect(indexes.some((index) => /UNIQUE.*tokenHash/i.test(index.indexdef))).toBe(true);
    });

    it('makes the host key fingerprint unique', async () => {
      const indexes: { indexdef: string }[] = await dataSource.query(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'host'`,
      );
      expect(indexes.some((index) => /UNIQUE.*publicKeyFingerprint/i.test(index.indexdef))).toBe(
        true,
      );
    });

    it('grants the default user role its own hosts', async () => {
      const [role]: { permissions: { action: string; subject: string; conditions?: unknown }[] }[] =
        await dataSource.query(
          `SELECT permissions FROM "role" WHERE name = 'user' AND "organizationId" IS NULL`,
        );

      const hostRules = role.permissions.filter((rule) => rule.subject === 'Host');
      expect(hostRules).toHaveLength(1);
      expect(hostRules[0].action).toBe('manage');
      // Conditioned on the owner, or every account would manage every machine.
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a condition placeholder the ability factory interpolates, not a template literal
      expect(hostRules[0].conditions).toEqual({ ownerUserId: '${user.id}' });
    });
  });

  describe('minting a pairing token', () => {
    it('returns the secret exactly once, inside the install command', async () => {
      const minted = await mintPairingToken('Laptop');

      expect(minted.body?.installCommand).toContain('https://releases.example.test/install.sh');
      expect(minted.body?.agentPrompt).toContain('Install the Oppenheimer runner');
      expect(minted.body?.prefix).toMatch(/^opr_reg_/);

      const listed = await call('/api/v1/hosts/pairing', { token: user.sessionToken });
      expect(JSON.stringify(listed.body)).not.toContain(minted.secret);
    });

    it('stores only a digest, and the address it was minted from', async () => {
      const minted = await mintPairingToken();

      const rows: { tokenHash: string; createdFromIp: string | null }[] = await dataSource.query(
        'SELECT "tokenHash", "createdFromIp" FROM "host_pairing_token" WHERE "id" = $1',
        [minted.id],
      );
      expect(rows[0].tokenHash).toBe(createHash('sha256').update(minted.secret).digest('hex'));
      expect(rows[0].tokenHash).not.toBe(minted.secret);
      expect(rows[0].createdFromIp).toBeTruthy();
    });

    /** Mint as `owner`, who is a fresh account so no other test's tokens count. */
    const mintAs = (owner: { sessionToken: string }, body: Record<string, unknown>) =>
      call('/api/v1/hosts/pairing', { method: 'POST', token: owner.sessionToken, body });
    const revokedAt = async (id: string) =>
      (
        (await dataSource.query('SELECT "revokedAt" FROM "host_pairing_token" WHERE "id" = $1', [
          id,
        ])) as { revokedAt: Date | null }[]
      )[0].revokedAt;

    it('holds the cap when mints race', async () => {
      const owner = await signUp('cap-race@example.com');

      const results = await Promise.all(
        Array.from({ length: 8 }, () => mintAs(owner, { name: 'Race' })),
      );

      // The count and the insert are one serialised write, so of eight at once
      // only the cap of five find room.
      expect(results.filter((r) => r.status === 201)).toHaveLength(5);
      for (const refused of results.filter((r) => r.status !== 201)) {
        expect(refused.status).toBe(429);
        expect(refused.body?.code).toBe('HOSTS_006');
      }
    });

    it('replaces a token in the same write, even at the cap', async () => {
      const owner = await signUp('cap-replace@example.com');
      const held = [];
      for (let i = 0; i < 5; i++) held.push(await mintAs(owner, { name: 'Full' }));
      expect((await mintAs(owner, { name: 'Full' })).status).toBe(429);

      const replacement = await mintAs(owner, { name: 'Full', replaces: held[0].body?.id });

      expect(replacement.status).toBe(201);
      expect(await revokedAt(held[0].body?.id as string)).not.toBeNull();
    });

    it('leaves the old token alone when the mint is refused', async () => {
      const owner = await signUp('cap-refused@example.com');
      const stranger = await signUp('cap-stranger@example.com');
      const mine = await mintAs(owner, { name: 'Mine' });

      const refused = await mintAs(stranger, { name: 'Theirs', replaces: mine.body?.id });

      expect(refused.status).toBe(404);
      expect(refused.body?.code).toBe('HOSTS_002');
      expect(await revokedAt(mine.body?.id as string)).toBeNull();
    });
  });

  describe('registering a host', () => {
    it('pairs the machine, adopts the token’s name and answers the pinned fingerprint', async () => {
      const minted = await mintPairingToken('Named by the console');
      const key = hostKey();

      const registered = await register(minted.secret, key);

      expect(registered.status, JSON.stringify(registered.body)).toBe(201);
      const expected = createHash('sha256')
        .update(controlPlane.publicKey.export({ format: 'der', type: 'spki' }).subarray(12))
        .digest('hex');
      expect(registered.body?.fingerprint).toBe(expected);
      expect(registered.body?.channel).toBe('stable');

      const host = await call(`/api/v1/hosts/${registered.body?.hostId}`, {
        token: user.sessionToken,
      });
      expect(host.status).toBe(200);
      expect(host.body).toMatchObject({
        name: 'Named by the console',
        ownerUserId: user.id,
        hostname: 'devbox.local',
        os: 'macos 15.2',
        arch: 'arm64',
        runnerVersion: '0.3.1',
        // Nothing has sent a heartbeat, so it cannot be online.
        online: false,
      });
      // `FACTS` is `Facts` as Go marshals it, including a `claude` probe with no
      // path: a schema only the unit fixtures could satisfy fails here.
      expect(host.body?.capabilities).toEqual(FACTS);
      expect(host.body?.publicKeyFingerprint).toBe(key.fingerprint);
    });

    it('queues the security email that tells the owner a machine was paired', async () => {
      // The unit test mocks the queue, and a mock accepts job ids BullMQ
      // refuses: a colon in a custom id made every add throw, so no owner was
      // ever told. Only the real queue can say the job is there.
      const minted = await mintPairingToken('Notify the owner');
      const registered = await register(minted.secret, hostKey());
      expect(registered.status, JSON.stringify(registered.body)).toBe(201);
      const hostId = registered.body?.hostId as string;

      const emails = app.get<Queue>(getQueueToken(QUEUE_NAMES.EMAIL));
      await vi.waitFor(
        async () => {
          const job = await emails.getJob(`host-paired-${hostId}`);
          expect(job?.name).toBe('host-paired');
          expect(job?.data).toMatchObject({
            to: user.email,
            userId: user.id,
            hostId,
            hostName: 'Notify the owner',
          });
        },
        { timeout: 10_000, interval: 200 },
      );
    });

    it('refuses a facts document that is not one', async () => {
      const minted = await mintPairingToken();
      const refused = await call('/api/v1/hosts/register', {
        method: 'POST',
        body: {
          token: minted.secret,
          name: 'wrong shape',
          publicKey: hostKey().base64,
          facts: { hostname: 'devbox.local', os: 'macos', arch: 'arm64' },
        },
      });

      // A validation failure, not a pairing failure: the token is untouched and
      // can still be spent by a runner that sends what it is specified to send.
      expect(refused.status).toBe(400);
    });

    it('records where the token was spent, beside where it was minted', async () => {
      const minted = await mintPairingToken();
      await register(minted.secret, hostKey());

      const rows: { redeemedFromIp: string | null; redeemedHostId: string | null }[] =
        await dataSource.query(
          'SELECT "redeemedFromIp", "redeemedHostId" FROM "host_pairing_token" WHERE "id" = $1',
          [minted.id],
        );
      expect(rows[0].redeemedFromIp).toBeTruthy();
      expect(rows[0].redeemedHostId).toBeTruthy();
    });

    it('is single-use under two concurrent redemptions', async () => {
      const minted = await mintPairingToken();
      const first = hostKey();
      const second = hostKey();

      const [a, b] = await Promise.all([
        register(minted.secret, first),
        register(minted.secret, second),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 401]);
      const refused = a.status === 401 ? a : b;
      expect(refused.body?.code).toBe('HOSTS_003');

      const rows: { count: string }[] = await dataSource.query(
        'SELECT count(*) FROM "host" WHERE "publicKeyFingerprint" = ANY($1)',
        [[first.fingerprint, second.fingerprint]],
      );
      expect(Number(rows[0].count)).toBe(1);
    });

    it('returns the same host when the same machine retries', async () => {
      const minted = await mintPairingToken();
      const key = hostKey();

      const first = await register(minted.secret, key);
      const retry = await register(minted.secret, key);

      expect(retry.status).toBe(201);
      expect(retry.body?.hostId).toBe(first.body?.hostId);
    });

    it('refuses a revoked token', async () => {
      const minted = await mintPairingToken();
      const revoked = await call(`/api/v1/hosts/pairing/${minted.id}`, {
        method: 'DELETE',
        token: user.sessionToken,
      });
      expect(revoked.status).toBe(204);

      const registered = await register(minted.secret, hostKey());

      expect(registered.status).toBe(401);
      expect(registered.body?.code).toBe('HOSTS_003');
    });

    it('refuses a token nobody minted', async () => {
      const registered = await register('opr_reg_never-existed-0123456789', hostKey());

      expect(registered.status).toBe(401);
      expect(registered.body?.code).toBe('HOSTS_003');
    });
  });

  describe('the host principal', () => {
    it('unpairs itself with a signed assertion, and says so idempotently', async () => {
      const minted = await mintPairingToken();
      const key = hostKey();
      const registered = await register(minted.secret, key);
      const hostId = registered.body?.hostId as string;

      const first = await call('/api/v1/hosts/self', {
        method: 'DELETE',
        token: bootAssertion(key.privateKey, hostId),
      });
      expect(first.status).toBe(204);

      // A fresh assertion, because the first one's `jti` is burned.
      const second = await call('/api/v1/hosts/self', {
        method: 'DELETE',
        token: bootAssertion(key.privateKey, hostId),
      });
      expect(second.status).toBe(204);

      const host = await call(`/api/v1/hosts/${hostId}`, { token: user.sessionToken });
      expect(host.body?.unpairedAt).toBeTruthy();
    });

    it('refuses a replayed assertion', async () => {
      const minted = await mintPairingToken();
      const key = hostKey();
      const registered = await register(minted.secret, key);
      const assertion = bootAssertion(key.privateKey, registered.body?.hostId as string);

      const first = await call('/api/v1/hosts/self', { method: 'DELETE', token: assertion });
      const replay = await call('/api/v1/hosts/self', { method: 'DELETE', token: assertion });

      expect(first.status).toBe(204);
      expect(replay.status).toBe(401);
      expect(replay.body?.code).toBe('HOSTS_005');
    });

    it('refuses an assertion signed by a key this host does not hold', async () => {
      const minted = await mintPairingToken();
      const key = hostKey();
      const registered = await register(minted.secret, key);
      const stranger = hostKey();

      const forged = await call('/api/v1/hosts/self', {
        method: 'DELETE',
        token: bootAssertion(stranger.privateKey, registered.body?.hostId as string),
      });

      expect(forged.status).toBe(401);
      expect(forged.body?.code).toBe('HOSTS_005');
    });

    it('cannot reach a route a person’s credential is for', async () => {
      const minted = await mintPairingToken();
      const key = hostKey();
      const registered = await register(minted.secret, key);

      const listed = await call('/api/v1/hosts', {
        token: bootAssertion(key.privateKey, registered.body?.hostId as string),
      });

      // A machine holds no permissions of its own, so `hosts:read` refuses it.
      expect(listed.status).toBe(403);
      expect(listed.body?.code).toBe('TOKEN_005');
    });

    it('refuses a session cookie on the host-only route', async () => {
      const refused = await call('/api/v1/hosts/self', {
        method: 'DELETE',
        token: user.sessionToken,
      });

      expect(refused.status).toBe(401);
      expect(refused.body?.code).toBe('HOSTS_005');
    });
  });

  /**
   * The four side tables a host's metadata lives in
   * (`product/versions/mvp/15-host-metadata.md`). Their writes are raw SQL —
   * upserts, keyset reads, batched deletes — so nothing but a real Postgres
   * checks them. The heartbeat and the connect go through `HostPresencePort`,
   * the same entry the runner link calls.
   */
  describe('host metadata', () => {
    let hostId: string;
    let presence: HostPresencePort;
    let metadata: HostMetadataRepositoryPort;

    const rows = async (sql: string, params: unknown[] = []) =>
      (await dataSource.query(sql, params)) as Record<string, unknown>[];
    const kinds = async () =>
      (
        await rows(
          `SELECT "kind" FROM "host_event" WHERE "hostId" = $1 ORDER BY "occurredAt" DESC, "id" DESC`,
          [hostId],
        )
      ).map((row) => row.kind);

    beforeAll(async () => {
      presence = app.get<HostPresencePort>(HOST_PRESENCE);
      metadata = app.get<HostMetadataRepositoryPort>(HOST_METADATA_REPOSITORY);
      const minted = await mintPairingToken('Metadata box');
      const registered = await register(minted.secret, hostKey());
      expect(registered.status, JSON.stringify(registered.body)).toBe(201);
      hostId = registered.body?.hostId as string;
    });

    it('registers an inventory and a paired entry, and no presence until the link reports', async () => {
      const [inventory] = await rows(
        `SELECT "platform", "hostname", "facts" FROM "host_inventory" WHERE "hostId" = $1`,
        [hostId],
      );
      expect(inventory).toMatchObject({ platform: 'macos', hostname: 'devbox.local' });
      expect(inventory?.facts).toEqual(FACTS);
      expect(
        await rows(`SELECT 1 FROM "host_presence" WHERE "hostId" = $1`, [hostId]),
      ).toHaveLength(0);
      expect(await kinds()).toEqual(['paired']);
    });

    it('keeps one presence row across heartbeats, and answers the newest free disk', async () => {
      const [before] = await rows(`SELECT "changedAt" FROM "host_inventory" WHERE "hostId" = $1`, [
        hostId,
      ]);

      expect(
        await presence.observe(hostId, {
          facts: { ...FACTS, diskFreeBytes: 100 },
          loadAverage: 1.5,
        }),
      ).toBe('recorded');
      expect(
        await presence.observe(hostId, {
          facts: { ...FACTS, diskFreeBytes: 99 },
          roundTripMillis: 12,
        }),
      ).toBe('recorded');

      expect(
        await rows(`SELECT 1 FROM "host_presence" WHERE "hostId" = $1`, [hostId]),
      ).toHaveLength(1);
      const host = await call(`/api/v1/hosts/${hostId}`, { token: user.sessionToken });
      expect(host.status).toBe(200);
      expect(host.body).toMatchObject({ online: true, status: 'idle' });
      // A value a beat did not report keeps what is on file.
      expect(host.body?.vitals).toMatchObject({
        diskFreeBytes: 99,
        loadAverage: 1.5,
        roundTripMillis: 12,
      });
      expect(host.body?.capabilities).toMatchObject({ diskFreeBytes: 99 });

      // Free disk moving is presence, not a change to the machine.
      const [after] = await rows(`SELECT "changedAt" FROM "host_inventory" WHERE "hostId" = $1`, [
        hostId,
      ]);
      expect(after?.changedAt).toEqual(before?.changedAt);
      expect(await kinds()).toEqual(['paired']);
    });

    it('records nothing for a host whose owner is banned, and again once they are not', async () => {
      // A hello always asks after the owner (a heartbeat trusts the last answer
      // for a minute), so the ban is seen at once here.
      const hello = () => presence.observe(hostId, { facts: FACTS, connectedAt: new Date() });
      await dataSource.query(`UPDATE "user" SET "banned" = true WHERE "id" = $1`, [user.id]);
      try {
        expect(await hello()).toBe('owner_refused');
      } finally {
        await dataSource.query(`UPDATE "user" SET "banned" = false WHERE "id" = $1`, [user.id]);
      }
      expect(await hello()).toBe('recorded');
    });

    it('logs a changed fact with its diff, and a newly known one as nothing', async () => {
      // Registration did not report a CPU count: learning it is not a change.
      await presence.observe(hostId, { facts: { ...FACTS, cpus: 8 } });
      expect(await kinds()).toEqual(['paired']);
      const [learned] = await rows(`SELECT "cpuCount" FROM "host_inventory" WHERE "hostId" = $1`, [
        hostId,
      ]);
      expect(learned?.cpuCount).toBe(8);

      await presence.observe(hostId, { facts: { ...FACTS, cpus: 16 } });
      const [entry] = await rows(
        `SELECT "kind", "payload" FROM "host_event" WHERE "hostId" = $1 ORDER BY "occurredAt" DESC, "id" DESC LIMIT 1`,
        [hostId],
      );
      expect(entry).toMatchObject({
        kind: 'facts_changed',
        payload: { changed: { cpuCount: [8, 16] } },
      });
    });

    it('records each address once and puts a move on the timeline', async () => {
      await presence.connectedFrom(hostId, '203.0.113.7');
      await presence.connectedFrom(hostId, '203.0.113.7');
      expect(await rows(`SELECT 1 FROM "host_network" WHERE "hostId" = $1`, [hostId])).toHaveLength(
        1,
      );
      expect((await kinds()).filter((kind) => kind === 'network_changed')).toHaveLength(0);

      await presence.connectedFrom(hostId, '198.51.100.9');
      expect(await rows(`SELECT 1 FROM "host_network" WHERE "hostId" = $1`, [hostId])).toHaveLength(
        2,
      );
      expect((await kinds())[0]).toBe('network_changed');

      const host = await call(`/api/v1/hosts/${hostId}`, { token: user.sessionToken });
      expect(host.body?.network).toMatchObject({ ip: '198.51.100.9' });
    });

    it('pages the timeline newest first, each entry once', async () => {
      const all = await kinds();
      expect(all.length).toBeGreaterThanOrEqual(3);

      const seen: string[] = [];
      let before: string | null = null;
      do {
        const query: string = before ? `?limit=2&before=${encodeURIComponent(before)}` : '?limit=2';
        const page = await call(`/api/v1/hosts/${hostId}/timeline${query}`, {
          token: user.sessionToken,
        });
        expect(page.status, JSON.stringify(page.body)).toBe(200);
        const entries = page.body?.entries as { id: string; kind: string }[];
        expect(entries.length).toBeLessThanOrEqual(2);
        seen.push(...entries.map((entry) => entry.kind));
        before = (page.body?.next as string | null) ?? null;
      } while (before);

      expect(seen).toEqual(all);
    });

    it('retention drops old events and unseen networks, never the current one', async () => {
      const day = 24 * 60 * 60 * 1000;
      await dataSource.query(
        `UPDATE "host_network" SET "firstSeenAt" = now() - interval '100 days', "lastSeenAt" = now() - interval '100 days' WHERE "hostId" = $1`,
        [hostId],
      );
      await dataSource.query(
        `UPDATE "host_event" SET "occurredAt" = now() - interval '200 days' WHERE "hostId" = $1 AND "kind" = 'network_changed'`,
        [hostId],
      );

      expect(await metadata.deleteNetworksUnseenSince(new Date(Date.now() - 90 * day), 5000)).toBe(
        1,
      );
      expect(await metadata.deleteTimelineBefore(new Date(Date.now() - 180 * day), 5000)).toBe(1);

      const left = await rows(
        `SELECT n."ip" FROM "host_network" n JOIN "host_presence" p ON p."currentNetworkId" = n."id" WHERE n."hostId" = $1`,
        [hostId],
      );
      expect(left.map((row) => row.ip)).toEqual(['198.51.100.9']);
      expect(await rows(`SELECT 1 FROM "host_network" WHERE "hostId" = $1`, [hostId])).toHaveLength(
        1,
      );
      expect(await kinds()).not.toContain('network_changed');
    });

    it('writes presence only for a paired host, in one statement that is also the check', async () => {
      const presenceOf = () =>
        rows(
          `SELECT "loadAverage"::float8 AS "loadAverage", "roundTripMillis" FROM "host_presence" WHERE "hostId" = $1`,
          [hostId],
        );
      await dataSource.query(`DELETE FROM "host_presence" WHERE "hostId" = $1`, [hostId]);

      // Inserts, then updates, keeping what a later report leaves out.
      expect(await metadata.recordVitalsIfPaired(hostId, { loadAverage: 0.5 }, new Date())).toBe(
        true,
      );
      expect(await presenceOf()).toEqual([{ loadAverage: 0.5, roundTripMillis: null }]);
      expect(await metadata.recordVitalsIfPaired(hostId, { roundTripMillis: 7 }, new Date())).toBe(
        true,
      );
      expect(await presenceOf()).toEqual([{ loadAverage: 0.5, roundTripMillis: 7 }]);

      // A host nobody paired, and one unpaired since: nothing is written.
      expect(
        await metadata.recordVitalsIfPaired(
          'e0e0e0e0-0000-4000-8000-000000000000',
          { loadAverage: 9 },
          new Date(),
        ),
      ).toBe(false);
      await dataSource.query(`UPDATE "host" SET "unpairedAt" = now() WHERE "id" = $1`, [hostId]);
      try {
        expect(await metadata.recordVitalsIfPaired(hostId, { loadAverage: 9 }, new Date())).toBe(
          false,
        );
        expect(await presence.observe(hostId, { facts: FACTS })).toBe('unpaired');
        expect(await presenceOf()).toEqual([{ loadAverage: 0.5, roundTripMillis: 7 }]);
      } finally {
        await dataSource.query(`UPDATE "host" SET "unpairedAt" = NULL WHERE "id" = $1`, [hostId]);
      }
    });

    it('answers a heartbeat whose inventory is unchanged with one statement', async () => {
      // The first beat after the hello records what this process last saw.
      await presence.observe(hostId, { facts: FACTS });
      const spy = vi.spyOn(PostgresQueryRunner.prototype, 'query');
      try {
        expect(await presence.observe(hostId, { facts: FACTS, loadAverage: 0.25 })).toBe(
          'recorded',
        );
        // Only this host's statements: the app's own background work runs beside it.
        const mine = spy.mock.calls.filter(([, parameters]) => (parameters ?? []).includes(hostId));
        expect(mine).toHaveLength(1);
        expect(String(mine[0]?.[0])).toMatch(/INSERT INTO "host_presence"/);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('scoping', () => {
    it('does not show one person’s host to another', async () => {
      const minted = await mintPairingToken();
      const registered = await register(minted.secret, hostKey());
      const stranger = await signUp('host-stranger@example.com');

      const listed = await call('/api/v1/hosts', { token: stranger.sessionToken });
      const hosts = listed.body as unknown as { id: string }[];
      expect(hosts.some((host) => host.id === registered.body?.hostId)).toBe(false);

      // And the detail route agrees with the list, because both read through the
      // same scoped query.
      const detail = await call(`/api/v1/hosts/${registered.body?.hostId}`, {
        token: stranger.sessionToken,
      });
      expect(detail.status).toBe(404);
      expect(detail.body?.code).toBe('HOSTS_001');
    });

    it('does not show one person’s pairing tokens to another', async () => {
      const minted = await mintPairingToken('Private box');
      const stranger = await signUp('token-stranger@example.com');

      const listed = await call('/api/v1/hosts/pairing', { token: stranger.sessionToken });
      const tokens = listed.body as unknown as { id: string }[];
      expect(tokens.some((token) => token.id === minted.id)).toBe(false);
    });
  });
});
