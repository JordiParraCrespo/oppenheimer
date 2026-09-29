import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import pg from 'pg';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';

/**
 * Better Auth's session cache (`secondaryStorage`) against a real Postgres and
 * Redis: what a request costs with it, and that no cached session outlives
 * the change that should end or alter it.
 *
 * Query counts are measured by wrapping `pg.Client.prototype.query`, which
 * every pool in the process — TypeORM's and Better Auth's — goes through.
 */
describe('Session cache (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;
  let redis: Redis;
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

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

    await runAllMigrations();
    // Imported only now: the Better Auth instance reads the database config at
    // module load.
    const { AppModule } = await import('../../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });

    const { VersioningType } = await import('@nestjs/common');
    const { SanitizePipe } = await import('@oppenheimer/backend-core');
    const { ZodValidationPipe } = await import('nestjs-zod');
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    dataSource = moduleRef.get(DataSource);
    redis = new Redis(redisContainer.getMappedPort(6379), redisContainer.getHost());
  }, 180000);

  afterAll(async () => {
    redis?.disconnect();
    await app?.close();
    const { emailQueue } = await import('../infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  // --- helpers -------------------------------------------------------------

  const PASSWORD = 'Integration-test-password-1';

  interface Account {
    id: string;
    email: string;
    /** The session as a bearer token (the CLI and mobile path): the signed cookie value. */
    sessionToken: string;
    /** The same session as the browser's cookie. */
    cookie: string;
    /** The raw session token, as the `session` row and Better Auth's cache key hold it. */
    rawToken: string;
  }

  /** `set-auth-token` is the signed cookie value, `<token>.<signature>`. */
  const rawTokenOf = (signed: string) => decodeURIComponent(signed).split('.')[0];

  function sessionCookie(response: Response): string {
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(';')[0])
      .find((pair) => pair.startsWith('better-auth.session_token='));
    expect(cookie).toBeTruthy();
    return cookie as string;
  }

  async function signUp(label: string): Promise<Account> {
    const email = `${label}-${randomUUID()}@example.com`;
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        name: 'Cache Owner',
        firstName: 'Cache',
        lastName: 'Owner',
      }),
    });
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { user: { id: string } };
    const sessionToken = response.headers.get('set-auth-token') as string;
    return {
      id: payload.user.id,
      email,
      sessionToken,
      cookie: sessionCookie(response),
      rawToken: rawTokenOf(sessionToken),
    };
  }

  async function signIn(email: string): Promise<Account> {
    const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { user: { id: string } };
    const sessionToken = response.headers.get('set-auth-token') as string;
    return {
      id: payload.user.id,
      email,
      sessionToken,
      cookie: sessionCookie(response),
      rawToken: rawTokenOf(sessionToken),
    };
  }

  async function call(
    path: string,
    auth: { cookie?: string; token?: string },
    init: { method?: string; body?: unknown } = {},
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(auth.cookie ? { cookie: auth.cookie } : {}),
        ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {}),
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
    };
  }

  /** The statements `run` sends to Postgres, from any pool in the process. */
  async function queriesDuring(run: () => Promise<unknown>): Promise<string[]> {
    const statements: string[] = [];
    const original = pg.Client.prototype.query;
    // biome-ignore lint/suspicious/noExplicitAny: wrapping an overloaded method
    (pg.Client.prototype as any).query = function (this: unknown, ...args: any[]) {
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
      // The outbox relay polls on its own schedule; it is not the request's.
      if (typeof text === 'string' && !/outbox_message/.test(text)) statements.push(text);
      return original.apply(this, args as never);
    };
    try {
      await run();
    } finally {
      pg.Client.prototype.query = original;
    }
    return statements;
  }

  const touchesTable = (statements: string[], table: string) =>
    statements.filter((sql) => sql.includes(`"${table}"`));

  /** Promote an account to the platform admin role, then sign in afresh. */
  async function signUpAdmin(): Promise<Account> {
    const admin = await signUp('admin');
    await dataSource.query(`UPDATE "user" SET "role" = 'admin' WHERE "id" = $1`, [admin.id]);
    return signIn(admin.email);
  }

  // --- what a request costs -----------------------------------------------

  describe('cost per request', () => {
    it('authenticates a cookie and a bearer session without reading the session table', async () => {
      const owner = await signUp('cost');
      const me = (auth: { cookie?: string; token?: string }) =>
        call('/api/v1/users/me', auth).then((r) => expect(r.status).toBe(200));
      // Warm the process's one-off lookups (role catalog, flags) first.
      await me({ cookie: owner.cookie });
      await me({ token: owner.sessionToken });

      const minted = await call('/api/v1/tokens', owner, {
        method: 'POST',
        body: { name: 'cost', scopes: ['tokens:read'] },
      });
      const apiToken = (minted.body as { token: string }).token;
      const credential = () =>
        call('/api/v1/me/credential', { token: apiToken }).then((r) => expect(r.status).toBe(200));
      await credential();

      const cookie = await queriesDuring(() => me({ cookie: owner.cookie }));
      const bearer = await queriesDuring(() => me({ token: owner.sessionToken }));
      const token = await queriesDuring(credential);

      if (process.env.QUERY_COUNT_OUT) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(
          process.env.QUERY_COUNT_OUT,
          JSON.stringify({ cookie, bearer, token }, null, 2),
        );
      }

      // Before the cache: a session-and-user read per cookie request, and for a
      // bearer session an OAuth lookup plus that read twice over.
      expect(touchesTable(cookie, 'session')).toEqual([]);
      expect(touchesTable(bearer, 'session')).toEqual([]);
      // The one query a bearer session costs: ruling out an OAuth grant.
      expect(touchesTable(bearer, 'oauthAccessToken')).toHaveLength(1);
      // An API token used a moment ago is not stamped again.
      expect(token.filter((sql) => /^UPDATE "api_token"/.test(sql.trim()))).toEqual([]);
    });

    it('stores sessions under hashed keys only, and still writes them to Postgres', async () => {
      const owner = await signUp('keys');

      const keys = await redis.keys('*');
      const sessionKeys = keys.filter((key) => key.startsWith('ba:'));
      expect(sessionKeys.length).toBeGreaterThan(0);
      for (const key of sessionKeys) expect(key).toMatch(/^ba:[0-9a-f]{64}$/);
      // No raw token, and no user id, in any key name at all.
      for (const key of keys) {
        expect(key).not.toContain(owner.rawToken);
        expect(key).not.toContain(owner.id);
      }

      const [{ n }] = await dataSource.query(
        'SELECT count(*)::int AS n FROM "session" WHERE "userId" = $1',
        [owner.id],
      );
      expect(n).toBe(1);
    });
  });

  // --- revocation ---------------------------------------------------------

  describe('a cached session never outlives its revocation', () => {
    it('revoking one session removes it from Postgres and from Redis', async () => {
      const owner = await signUp('revoke');
      const other = await signIn(owner.email);
      const [row] = await dataSource.query('SELECT "id" FROM "session" WHERE "token" = $1', [
        other.rawToken,
      ]);
      const { sessionStoreKey } = await import(
        '../infrastructure/better-auth-secondary-storage.adapter'
      );
      expect(await redis.exists(sessionStoreKey(other.rawToken))).toBe(1);

      const revoked = await call(`/api/v1/profile/sessions/${row.id}`, owner, {
        method: 'DELETE',
      });
      expect(revoked.status).toBe(204);

      expect((await call('/api/v1/users/me', { cookie: other.cookie })).status).toBe(401);
      expect(
        await dataSource.query('SELECT 1 FROM "session" WHERE "id" = $1', [row.id]),
      ).toHaveLength(0);
      expect(await redis.exists(sessionStoreKey(other.rawToken))).toBe(0);
      expect((await call('/api/v1/users/me', { cookie: owner.cookie })).status).toBe(200);
    });

    it('signs out a session the cache never knew when signing out other devices', async () => {
      // A session signed in before the cache existed has a row and no copy;
      // Better Auth's own sweep finds sessions through the cache's index.
      const owner = await signUp('legacy');
      const legacy = await signIn(owner.email);
      const { sessionStoreKey } = await import(
        '../infrastructure/better-auth-secondary-storage.adapter'
      );
      await redis.del(sessionStoreKey(legacy.rawToken));
      await redis.del(sessionStoreKey(`active-sessions-${owner.id}`));
      expect((await call('/api/v1/users/me', { cookie: legacy.cookie })).status).toBe(200);

      const swept = await call('/api/v1/profile/sessions', owner, { method: 'DELETE' });
      expect(swept.status).toBe(204);

      expect((await call('/api/v1/users/me', { cookie: legacy.cookie })).status).toBe(401);
      expect((await call('/api/v1/users/me', { cookie: owner.cookie })).status).toBe(200);
    });

    it('refuses a deleted account’s cookie on the next request', async () => {
      const owner = await signUp('deleted');
      expect((await call('/api/v1/users/me', owner)).status).toBe(200);

      const deleted = await call('/api/v1/profile', owner, {
        method: 'DELETE',
        body: { confirmation: owner.email },
      });
      expect(deleted.status).toBe(204);

      expect((await call('/api/v1/users/me', { cookie: owner.cookie })).status).toBe(401);
      expect((await call('/api/v1/users/me', { token: owner.sessionToken })).status).toBe(401);
    });

    it('refuses a deactivated account’s cookie on the next request', async () => {
      const owner = await signUp('deactivated');
      expect((await call('/api/v1/users/me', owner)).status).toBe(200);

      // No route deactivates an account yet (`PATCH /users/:id` does not take
      // `isActive`); the use case is what one will dispatch.
      const { CommandBus } = await import('@nestjs/cqrs');
      const { UpdateUserCommand } = await import(
        '../../users/commands/update-user/update-user.command'
      );
      await app
        .get(CommandBus)
        .execute(new UpdateUserCommand({ userId: owner.id, isActive: false }));

      // Not waiting for the outbox: the cached copy is refreshed in the request.
      expect((await call('/api/v1/users/me', { cookie: owner.cookie })).status).toBe(401);
    });

    it('refuses a banned account’s cookie on the next request', async () => {
      const admin = await signUpAdmin();
      const owner = await signUp('banned');
      expect((await call('/api/v1/users/me', owner)).status).toBe(200);

      const banned = await call(`/api/v1/admin/users/${owner.id}/ban`, admin, {
        method: 'POST',
        body: { banReason: 'integration test' },
      });
      expect(banned.status).toBeLessThan(300);

      expect((await call('/api/v1/users/me', { cookie: owner.cookie })).status).toBe(401);
      expect((await call('/api/v1/users/me', { token: owner.sessionToken })).status).toBe(401);
    });
  });

  describe('beyond what Better Auth reads before a bulk delete', () => {
    it('signing a user with more than a hundred sessions out everywhere evicts every copy', async () => {
      const admin = await signUpAdmin();
      const owner = await signUp('many');
      const { auth } = await import('../infrastructure/better-auth.config');
      const { sessionStoreKey } = await import(
        '../infrastructure/better-auth-secondary-storage.adapter'
      );
      const context = await auth.$context;
      const tokens = [owner.rawToken];
      for (let i = 0; i < 149; i++) {
        tokens.push((await context.internalAdapter.createSession(owner.id)).token);
      }
      // Better Auth's own index is a cache entry too: without it, only the rows
      // lead to the copies, and it hands the hook at most a hundred of them.
      await redis.del(sessionStoreKey(`active-sessions-${owner.id}`));
      const cached = async () =>
        (await Promise.all(tokens.map((token) => redis.exists(sessionStoreKey(token))))).filter(
          Boolean,
        ).length;
      expect(await cached()).toBe(150);

      const revoked = await call(`/api/v1/admin/users/${owner.id}/revoke-sessions`, admin, {
        method: 'POST',
      });
      expect(revoked.status).toBeLessThan(300);

      expect(
        await dataSource.query('SELECT 1 FROM "session" WHERE "userId" = $1', [owner.id]),
      ).toHaveLength(0);
      expect(await cached()).toBe(0);
    }, 60_000);
  });

  describe('the admin session list', () => {
    it('lists and revokes a session the cache never knew', async () => {
      // Signed in before the cache existed: a row, no copy, no index entry.
      const admin = await signUpAdmin();
      const owner = await signUp('uncached');
      const legacy = await signIn(owner.email);
      const { sessionStoreKey } = await import(
        '../infrastructure/better-auth-secondary-storage.adapter'
      );
      await redis.del(sessionStoreKey(legacy.rawToken));
      await redis.del(sessionStoreKey(`active-sessions-${owner.id}`));
      const [row] = await dataSource.query('SELECT "id" FROM "session" WHERE "token" = $1', [
        legacy.rawToken,
      ]);

      const listed = await call(`/api/v1/admin/users/${owner.id}/sessions`, admin);
      expect(listed.status).toBe(200);
      const ids = (listed.body as unknown as { id: string }[]).map((session) => session.id);
      expect(ids).toContain(row.id);
      expect(JSON.stringify(listed.body)).not.toContain(legacy.rawToken);

      const revoked = await call(`/api/v1/admin/users/${owner.id}/sessions/revoke`, admin, {
        method: 'POST',
        body: { sessionId: row.id },
      });
      expect(revoked.status).toBeLessThan(300);
      expect((await call('/api/v1/users/me', { cookie: legacy.cookie })).status).toBe(401);
    });
  });

  // --- writes behind Better Auth's back -------------------------------------

  describe('the cached copy follows the rows the application writes', () => {
    const currentSession = async (account: Account) =>
      (await (
        await fetch(`${baseUrl}/api/auth/get-session`, { headers: { cookie: account.cookie } })
      ).json()) as {
        session: { activeOrganizationId: string | null };
        user: { firstName: string };
      };

    it('sign-up’s session is already in the workspace sign-up provisioned', async () => {
      const owner = await signUp('provisioned');
      const [membership] = await dataSource.query(
        'SELECT "organizationId" FROM "member" WHERE "userId" = $1',
        [owner.id],
      );

      expect((await currentSession(owner)).session.activeOrganizationId).toBe(
        membership.organizationId,
      );
    });

    it('a removed member stops acting in the organization they were removed from', async () => {
      const owner = await signUp('org-owner');
      const member = await signUp('org-member');
      const [{ organizationId }] = await dataSource.query(
        'SELECT "organizationId" FROM "member" WHERE "userId" = $1',
        [owner.id],
      );

      const added = await call(`/api/v1/organizations/${organizationId}/members`, owner, {
        method: 'POST',
        body: { userId: member.id, role: 'member' },
      });
      expect(added.status).toBe(201);
      const switched = await call(`/api/v1/organizations/${organizationId}/set-active`, member, {
        method: 'POST',
      });
      expect(switched.status).toBeLessThan(300);
      expect((await currentSession(member)).session.activeOrganizationId).toBe(organizationId);

      const removed = await call(
        `/api/v1/organizations/${organizationId}/members/${member.email}`,
        owner,
        { method: 'DELETE' },
      );
      expect(removed.status).toBeLessThan(300);

      expect((await currentSession(member)).session.activeOrganizationId).not.toBe(organizationId);
      const listed = await call('/api/v1/organizations', member);
      expect((listed.body as unknown as { id: string }[]).map((org) => org.id)).not.toContain(
        organizationId,
      );
    });

    it('a profile edit is what the session reports next', async () => {
      const owner = await signUp('renamed');

      const updated = await call('/api/v1/profile', owner, {
        method: 'PATCH',
        body: { firstName: 'Renamed' },
      });
      expect(updated.status).toBe(200);

      expect((await currentSession(owner)).user.firstName).toBe('Renamed');
    });
  });

  // --- Redis unavailable (last: it stalls Redis for everyone) ---------------

  describe('with Redis down', () => {
    /** Long enough for three requests whose every Redis call times out after a second. */
    const PAUSE_MS = 10_000;

    it('authenticates from Postgres, and refuses to revoke rather than half-revoke', async () => {
      const owner = await signUp('outage');
      const other = await signIn(owner.email);
      const [row] = await dataSource.query('SELECT "id" FROM "session" WHERE "token" = $1', [
        other.rawToken,
      ]);

      // Every client's commands stall for a few seconds; the API's own client
      // gives up on each after a second (`redisCommandClientOptions`), exactly
      // as it does when Redis is gone.
      await redisContainer.exec(['redis-cli', 'CLIENT', 'PAUSE', String(PAUSE_MS), 'ALL']);
      try {
        expect((await call('/api/v1/users/me', { cookie: owner.cookie })).status).toBe(200);
        expect((await call('/api/v1/users/me', { token: owner.sessionToken })).status).toBe(200);

        const revoked = await call(`/api/v1/profile/sessions/${row.id}`, owner, {
          method: 'DELETE',
        });
        expect(revoked.status).toBeGreaterThanOrEqual(500);
      } finally {
        // Answered once the pause lifts; the rest of the suite needs Redis back.
        await redis.ping();
      }
      // Nothing was revoked in Postgres alone, where the copy would outlive it.
      expect(
        await dataSource.query('SELECT 1 FROM "session" WHERE "id" = $1', [row.id]),
      ).toHaveLength(1);
    });
  });
});
