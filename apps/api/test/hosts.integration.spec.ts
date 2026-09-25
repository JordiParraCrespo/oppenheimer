import { createHash, generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from './run-migrations';

/**
 * Pairing, against a real Postgres and Redis.
 *
 * This is the layer unit tests cannot reach, and two of the properties here only
 * exist in the database:
 *
 *  - **redemption is single-use under concurrency.** Two requests presenting one
 *    secret at the same moment must produce one host and one refusal. The rule
 *    lives in a single `UPDATE … WHERE … RETURNING`, so nothing short of two real
 *    connections racing on one row tests it.
 *  - **the default role actually grants `manage Host`.** A live database's roles
 *    are rows the migration chain wrote, not the constant the seed reads, and a
 *    missing rule is a 403 on every host route that no test with a stubbed
 *    ability would notice.
 *
 * The schema is built by running the **actual migration chain** rather than
 * `synchronize`, so a mistake in the migration fails here.
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

    // Without these three the host routes answer HOSTS_004 and nothing else
    // works, which is the deployment story — here they are all set.
    process.env.CONTROL_PLANE_SIGNING_KEY = controlPlane.privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64');
    process.env.RUNNER_RELEASE_BASE_URL = 'https://releases.example.test';
    process.env.RUNNER_INSTALL_URL = 'https://releases.example.test/install.sh';
    process.env.RUNNER_RELEASE_CHANNEL = 'stable';

    await runAllMigrations();

    const { AppModule } = await import('../src/app.module');
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
    const { emailQueue } = await import('../src/auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  // --- helpers -------------------------------------------------------------

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
        // `BETTER_AUTH_URL` is the control plane URL this deployment answers to.
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

  // --- the migration -------------------------------------------------------

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

      // Same person, same column name, same scope rule — which is why the token
      // repository is scoped by `HostResource` rather than a second declaration.
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

  // --- pairing -------------------------------------------------------------

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

      // The count and the insert are one serialised write, so eight at once
      // cannot all find room for a fifth.
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

      // Someone else's token is not found, and nothing was minted or revoked.
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
        // The family the runner installs a service for, plus the release it
        // reported; the parts stay separate in `capabilities`.
        os: 'macos 15.2',
        arch: 'arm64',
        runnerVersion: '0.3.1',
        // Nothing has sent a heartbeat, so it cannot be online.
        online: false,
      });
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

    it('accepts the document a real runner sends, tools array and all', async () => {
      // This is the test that would have caught a schema that only the unit
      // fixtures could satisfy: the body below is `Facts` as Go marshals it,
      // including a `claude` probe with no path because the tool was not found
      // and Go omits the empty string.
      const minted = await mintPairingToken('Real runner');
      const registered = await register(minted.secret, hostKey());

      expect(registered.status, JSON.stringify(registered.body)).toBe(201);
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

      // Exactly one wins. The other is refused with the one opaque answer, and
      // never with a second host.
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

      // A dropped response must not cost a token or pair a machine twice.
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

      // `revokedAt IS NULL` is a term of the burn, which is what makes the
      // console's revoke button mean anything.
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

      // A fresh assertion, because the first one's `jti` is burned. The answer is
      // the same the second time: the machine cannot tell "never here" from
      // "already gone", and neither side would act differently.
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
