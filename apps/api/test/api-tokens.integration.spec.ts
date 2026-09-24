import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from './run-migrations';

/**
 * End-to-end coverage of scoped credentials against a real Postgres and Redis.
 *
 * This is the layer unit tests cannot reach: the migration's SQL, the guards
 * running in a real request pipeline, and the intersection of a token's scopes
 * with its owner's live roles.
 *
 * The schema is built by running the **actual migration chain** rather than
 * `synchronize`, so a mistake in the migration fails here rather than in
 * production.
 */
describe('API tokens & scopes (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  /** Signed-in owner of the tokens under test. */
  let user: { id: string; email: string; sessionToken: string };

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

    await runMigrations();

    // Import AppModule (and the Better Auth instance, which reads the database
    // config at module load) only after the container env vars are set.
    const { AppModule } = await import('../src/app.module');
    // Rate limiting is skipped under NODE_ENV=test (see AppModule): a suite
    // that mints dozens of tokens would otherwise trip the deliberately low
    // limit on token creation.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });

    // Mirror `main.ts`: the global prefix, URI versioning and the validation
    // pipes are part of the request pipeline these tests are exercising.
    const { VersioningType } = await import('@nestjs/common');
    const { SanitizePipe } = await import('@oppenheimer/backend-core');
    const { ZodValidationPipe } = await import('nestjs-zod');

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    dataSource = moduleRef.get(DataSource);

    user = await signUp('owner@example.com');
  }, 180000);

  afterAll(async () => {
    await app?.close();
    // Better Auth's email queue is a module singleton outside the DI container,
    // so `app.close()` does not reach it. Close it before the containers go
    // away, or its in-flight ioredis commands reject into nothing.
    const { emailQueue } = await import('../src/auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  // --- helpers -------------------------------------------------------------

  /**
   * Build the schema from the **actual migration chain**, discovered from the
   * directory so it cannot drift when a migration is added.
   */
  async function runMigrations(): Promise<void> {
    await runAllMigrations();
  }

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

  /** Register a user through Better Auth and return a bearer session token. */
  async function signUp(email: string) {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Integration-test-password-1',
        name: 'Integration Owner',
        firstName: 'Integration',
        lastName: 'Owner',
      }),
    });

    expect(response.ok).toBe(true);
    const sessionToken = response.headers.get('set-auth-token');
    expect(sessionToken).toBeTruthy();

    const payload = (await response.json()) as {
      user: { id: string; email: string };
    };
    return {
      id: payload.user.id,
      email: payload.user.email,
      sessionToken: sessionToken as string,
    };
  }

  /** Mint a token as the signed-in owner, returning the one-time secret. */
  async function mintToken(body: Record<string, unknown>) {
    const created = await call('/api/v1/tokens', {
      method: 'POST',
      token: user.sessionToken,
      body,
    });

    expect(created.status).toBe(201);
    return created.body as unknown as {
      id: string;
      token: string;
      scopes: string[];
    };
  }

  /** Give the owner a role carrying these permissions, replacing any previous. */
  async function grantOwnerPermissions(permissions: { action: string; subject: string }[]) {
    const roleId = '11111111-1111-4111-8111-111111111111';
    await dataSource.query('DELETE FROM "user_role" WHERE "userId" = $1', [user.id]);
    await dataSource.query('DELETE FROM "role" WHERE "id" = $1', [roleId]);
    await dataSource.query(
      `INSERT INTO "role" ("id", "name", "description", "isSystem", "permissions")
         VALUES ($1, 'integration', 'integration test role', false, $2::jsonb)`,
      [roleId, JSON.stringify(permissions)],
    );
    await dataSource.query('INSERT INTO "user_role" ("userId", "roleId") VALUES ($1, $2)', [
      user.id,
      roleId,
    ]);
    // The ability is the union of the join roles *and* the legacy `user.role`
    // column, so point that at the same role — otherwise the seeded `user`
    // role keeps granting permissions this helper claims to have removed.
    await dataSource.query('UPDATE "user" SET "role" = $1 WHERE "id" = $2', [
      'integration',
      user.id,
    ]);
  }

  // --- the migration -------------------------------------------------------

  describe('migration', () => {
    it('creates the api_token table with the expected shape', async () => {
      const columns: {
        column_name: string;
        data_type: string;
        is_nullable: string;
      }[] = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns WHERE table_name = 'api_token'`,
      );
      const byName = new Map(columns.map((column) => [column.column_name, column]));

      expect(byName.get('tokenHash')?.data_type).toBe('character varying');
      expect(byName.get('scopes')?.data_type).toBe('jsonb');
      expect(byName.get('organizationIds')?.data_type).toBe('jsonb');
      expect(byName.get('organizationIds')?.is_nullable).toBe('YES');
      expect(byName.get('expiresAt')?.data_type).toBe('timestamp with time zone');
      expect(byName.get('revokedAt')?.is_nullable).toBe('YES');
    });

    it('makes the token digest unique, so a hash collision cannot be inserted twice', async () => {
      const indexes: { indexdef: string }[] = await dataSource.query(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'api_token'`,
      );
      expect(indexes.some((index) => /UNIQUE.*tokenHash/i.test(index.indexdef))).toBe(true);
    });

    it('cascades token deletion when the owner is deleted', async () => {
      const constraints: { delete_rule: string }[] = await dataSource.query(
        `SELECT rc.delete_rule
           FROM information_schema.referential_constraints rc
           JOIN information_schema.table_constraints tc
             ON tc.constraint_name = rc.constraint_name
          WHERE tc.table_name = 'api_token'`,
      );
      expect(constraints.every((constraint) => constraint.delete_rule === 'CASCADE')).toBe(true);
    });

    it('creates the Better Auth OAuth tables the MCP plugin needs', async () => {
      const tables: { table_name: string }[] = await dataSource.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_name IN ('oauthApplication', 'oauthAccessToken', 'oauthConsent')`,
      );
      expect(tables.map((table) => table.table_name).sort()).toEqual([
        'oauthAccessToken',
        'oauthApplication',
        'oauthConsent',
      ]);
    });

    it('grants the seeded user role permission over its own tokens', async () => {
      const [role]: { permissions: { action: string; subject: string }[] }[] =
        await dataSource.query(`SELECT permissions FROM "role" WHERE name = 'user'`);

      const tokenRules = role.permissions.filter((rule) => rule.subject === 'ApiToken');
      expect(tokenRules.map((rule) => rule.action).sort()).toEqual(['create', 'delete', 'read']);
    });

    it('leaves the user role holding its own tokens and its workspaces, and nothing else', async () => {
      // This used to assert that `Article` survived `AddApiTokenPermissions`,
      // as the marker that the migration added its rules without clobbering
      // what was already there. `Article` has since been removed on purpose —
      // it had no resource, module or table behind it — so the assertion is
      // now the stronger one it was standing in for: after the whole migration
      // chain, the default role grants exactly this set. Anything else
      // appearing here is a grant nobody decided to give a plain account.
      const [role]: {
        permissions: { action: string; subject: string; conditions?: unknown }[];
      }[] = await dataSource.query(`SELECT permissions FROM "role" WHERE name = 'user'`);

      expect(role.permissions.map((rule) => `${rule.action}:${rule.subject}`).sort()).toEqual([
        'create:ApiToken',
        'create:Organization',
        'delete:ApiToken',
        'manage:Host',
        'read:ApiToken',
        'read:Organization',
      ]);

      // The token rules stay scoped to the caller's own rows, and so does the
      // host rule — a host belongs to the person who paired it, so `manage Host`
      // is conditioned on `ownerUserId` exactly as `ApiToken` is on `userId`. The
      // workspace rules need no condition: Better Auth answers the read from the
      // caller's own memberships, and `create` is what lets a self-service
      // sign-up make its first workspace from onboarding.
      for (const rule of role.permissions.filter(
        (rule) => rule.subject === 'ApiToken' || rule.subject === 'Host',
      )) {
        expect(rule.conditions).toBeTruthy();
      }
      expect(role.permissions.some((rule) => rule.subject === 'Article')).toBe(false);
    });
  });

  // --- minting -------------------------------------------------------------

  describe('minting a token', () => {
    // These two are about the secret — returned once, stored as a digest — and
    // the scope on them is incidental. It is `tokens:read` rather than
    // `users:read` because they are the only tests here that mint as a plain
    // seeded user, with no `grantOwnerPermissions` call ahead of them, and
    // `TightenDefaultUserRole` deliberately took the unconditional `read User`
    // rule off that role. `users:read` is therefore ungrantable to it and the
    // mint is refused with 403 — correctly. `tokens:read` needs
    // `read ApiToken`, which the seeded role does still hold.
    it('returns the secret exactly once and never again', async () => {
      const created = await mintToken({
        name: 'read-only',
        scopes: ['tokens:read'],
      });
      expect(created.token).toMatch(/^oppenheimer_pat_/);

      const listed = await call('/api/v1/tokens', { token: user.sessionToken });
      const tokens = listed.body as unknown as Record<string, unknown>[];
      const mine = tokens.find((token) => token.id === created.id);

      expect(mine).toBeDefined();
      expect(JSON.stringify(mine)).not.toContain(created.token);
    });

    it('stores only a digest of the secret', async () => {
      const created = await mintToken({
        name: 'digest-check',
        scopes: ['tokens:read'],
      });
      const rows: { tokenHash: string }[] = await dataSource.query(
        'SELECT "tokenHash" FROM "api_token" WHERE "id" = $1',
        [created.id],
      );

      expect(rows[0].tokenHash).not.toBe(created.token);
      expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('refuses scopes the creator does not hold', async () => {
      // The creator may mint tokens and read users — but nothing about roles.
      await grantOwnerPermissions([
        { action: 'read', subject: 'User' },
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
      ]);

      const refused = await call('/api/v1/tokens', {
        method: 'POST',
        token: user.sessionToken,
        body: { name: 'too-much', scopes: ['roles:write'] },
      });

      expect(refused.status).toBe(403);
      expect(refused.body?.code).toBe('TOKEN_002');
    });

    it('rejects a scope outside the catalog', async () => {
      const refused = await call('/api/v1/tokens', {
        method: 'POST',
        token: user.sessionToken,
        body: { name: 'bogus', scopes: ['nonsense:read'] },
      });

      expect(refused.status).toBe(400);
    });
  });

  // --- authenticating ------------------------------------------------------

  describe('authenticating with a token', () => {
    beforeAll(async () => {
      await grantOwnerPermissions([
        { action: 'read', subject: 'User' },
        { action: 'delete', subject: 'User' },
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
        { action: 'delete', subject: 'ApiToken' },
      ]);
    });

    it('accepts a token carrying the required scope', async () => {
      const { token } = await mintToken({
        name: 'reader',
        scopes: ['users:read'],
      });
      const response = await call(`/api/v1/users/${user.id}`, { token });

      expect(response.status).toBe(200);
    });

    it('accepts the same token in the x-api-key header', async () => {
      const { token } = await mintToken({
        name: 'header-form',
        scopes: ['users:read'],
      });
      const response = await call(`/api/v1/users/${user.id}`, {
        headers: { 'x-api-key': token },
      });

      expect(response.status).toBe(200);
    });

    it('refuses a token missing the scope the route requires', async () => {
      const { token } = await mintToken({
        name: 'reader-only',
        scopes: ['users:read'],
      });
      const response = await call(`/api/v1/users/${user.id}`, {
        method: 'DELETE',
        token,
      });

      expect(response.status).toBe(403);
      expect(response.body?.code).toBe('TOKEN_005');
    });

    it('names the missing scope so the caller can fix it', async () => {
      const { token } = await mintToken({
        name: 'reader-msg',
        scopes: ['users:read'],
      });
      const response = await call(`/api/v1/users/${user.id}`, {
        method: 'DELETE',
        token,
      });

      expect(String(response.body?.detail)).toContain('users:write');
    });

    it('lets a write token through on a read route', async () => {
      const { token } = await mintToken({
        name: 'writer',
        scopes: ['users:write'],
      });
      const response = await call(`/api/v1/users/${user.id}`, { token });

      expect(response.status).toBe(200);
    });

    it('rejects an unknown token', async () => {
      const response = await call(`/api/v1/users/${user.id}`, {
        token: 'oppenheimer_pat_not-a-real-token',
      });

      expect(response.status).toBe(401);
      expect(response.body?.code).toBe('TOKEN_003');
    });

    it('rejects a request with no credential at all', async () => {
      const response = await call(`/api/v1/users/${user.id}`);
      expect(response.status).toBe(401);
    });
  });

  // --- the intersection ----------------------------------------------------

  describe('scopes intersected with the owner’s roles', () => {
    it('refuses a scope the token holds once the owner loses the role behind it', async () => {
      await grantOwnerPermissions([
        { action: 'read', subject: 'User' },
        { action: 'read', subject: 'Role' },
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
      ]);
      const { token } = await mintToken({
        name: 'roles-reader',
        scopes: ['roles:read'],
      });

      expect((await call('/api/v1/roles', { token })).status).toBe(200);

      // The owner loses the Role permission; the token is untouched.
      await grantOwnerPermissions([
        { action: 'read', subject: 'User' },
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
      ]);

      expect((await call('/api/v1/roles', { token })).status).toBe(403);
    });

    it('reports granted and effective scopes separately', async () => {
      await grantOwnerPermissions([
        { action: 'read', subject: 'User' },
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
      ]);
      const { token } = await mintToken({
        name: 'partly-inert',
        scopes: ['users:read'],
      });

      // Grant nothing but token management: users:read goes inert.
      await grantOwnerPermissions([
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
      ]);

      const response = await call('/api/v1/me/credential', { token });
      expect(response.status).toBe(200);
      expect(response.body?.kind).toBe('api-token');
      expect(response.body?.grantedScopes).toEqual(['users:read']);
      expect(response.body?.effectiveScopes).toEqual([]);
    });
  });

  // --- lifecycle -----------------------------------------------------------

  describe('lifecycle', () => {
    beforeAll(async () => {
      await grantOwnerPermissions([
        { action: 'read', subject: 'User' },
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
        { action: 'delete', subject: 'ApiToken' },
      ]);
    });

    it('stops accepting a token the moment it is revoked', async () => {
      const created = await mintToken({
        name: 'to-revoke',
        scopes: ['users:read'],
      });
      expect((await call(`/api/v1/users/${user.id}`, { token: created.token })).status).toBe(200);

      const revoked = await call(`/api/v1/tokens/${created.id}`, {
        method: 'DELETE',
        token: user.sessionToken,
      });
      expect(revoked.status).toBe(204);

      const after = await call(`/api/v1/users/${user.id}`, {
        token: created.token,
      });
      expect(after.status).toBe(401);
      expect(after.body?.code).toBe('TOKEN_003');
    });

    it('keeps the revoked record for the audit trail', async () => {
      const created = await mintToken({
        name: 'audit',
        scopes: ['users:read'],
      });
      await call(`/api/v1/tokens/${created.id}`, {
        method: 'DELETE',
        token: user.sessionToken,
      });

      const rows: { revokedAt: Date | null }[] = await dataSource.query(
        'SELECT "revokedAt" FROM "api_token" WHERE id = $1',
        [created.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].revokedAt).not.toBeNull();
    });

    it('records the revocation on the transactional outbox and delivers it', async () => {
      const created = await mintToken({
        name: 'outboxed',
        scopes: ['users:read'],
      });
      await call(`/api/v1/tokens/${created.id}`, {
        method: 'DELETE',
        token: user.sessionToken,
      });

      // The event row was written in the same transaction as the revocation
      // and drained by the relay before the request returned: processed, with
      // a lease trail and a human-readable reason.
      const rows: {
        status: string;
        reason: string;
        attempts: number;
        lockedBy: string | null;
        processedAt: Date | null;
      }[] = await dataSource.query(
        `SELECT "status", "reason", "attempts", "lockedBy", "processedAt"
         FROM "outbox_message"
         WHERE "eventName" = 'ApiTokenRevokedDomainEvent' AND "aggregateId" = $1`,
        [created.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('processed');
      expect(rows[0].reason).toContain('revoked');
      expect(rows[0].attempts).toBeGreaterThanOrEqual(1);
      expect(rows[0].processedAt).not.toBeNull();
    });

    it('refuses an expired token', async () => {
      const created = await mintToken({
        name: 'short-lived',
        scopes: ['users:read'],
        expiresInDays: 1,
      });

      await dataSource.query(`UPDATE "api_token" SET "expiresAt" = now() - interval '1 day'`, []);

      const response = await call(`/api/v1/users/${user.id}`, {
        token: created.token,
      });
      expect(response.status).toBe(401);

      await dataSource.query(`UPDATE "api_token" SET "expiresAt" = NULL WHERE id = $1`, [
        created.id,
      ]);
    });

    it('records when a token was last used', async () => {
      const created = await mintToken({
        name: 'usage',
        scopes: ['users:read'],
      });
      await call(`/api/v1/users/${user.id}`, { token: created.token });

      // The usage stamp is written outside the request path; give it a moment.
      await new Promise((resolve) => setTimeout(resolve, 250));

      const rows: { lastUsedAt: Date | null }[] = await dataSource.query(
        'SELECT "lastUsedAt" FROM "api_token" WHERE id = $1',
        [created.id],
      );
      expect(rows[0].lastUsedAt).not.toBeNull();
    });

    it('refuses a token used from outside its IP allowlist', async () => {
      const created = await mintToken({
        name: 'ip-locked',
        scopes: ['users:read'],
        ipAllowlist: ['198.51.100.0/24'],
      });

      const response = await call(`/api/v1/users/${user.id}`, {
        token: created.token,
      });
      expect(response.status).toBe(403);
      expect(response.body?.code).toBe('TOKEN_004');
    });

    it('accepts a token whose allowlist covers the caller', async () => {
      const created = await mintToken({
        name: 'ip-allowed',
        scopes: ['users:read'],
        // Loopback in both families — the test client connects over either.
        ipAllowlist: ['127.0.0.0/8', '::1'],
      });

      const response = await call(`/api/v1/users/${user.id}`, {
        token: created.token,
      });
      expect(response.status).toBe(200);
    });
  });

  // --- organization restriction -------------------------------------------

  describe('organization restriction', () => {
    it('refuses a token acting on an organization it is not scoped to', async () => {
      await grantOwnerPermissions([
        { action: 'read', subject: 'Member' },
        { action: 'read', subject: 'ApiToken' },
        { action: 'create', subject: 'ApiToken' },
      ]);

      // Sign-up provisions no organization any more — an account belongs
      // nowhere until it creates one or is invited — so give the owner a
      // membership to scope the token to.
      const organizationId = '44444444-4444-4444-8444-444444444444';
      await dataSource.query(
        `INSERT INTO "organization" ("id", "name", "slug", "createdAt")
           VALUES ($1, 'Integration Org', 'integration-org', now())
           ON CONFLICT ("id") DO NOTHING`,
        [organizationId],
      );
      await dataSource.query(
        `INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
           VALUES ($1, $2, $3, 'owner', now())`,
        ['55555555-5555-4555-8555-555555555555', organizationId, user.id],
      );

      const { token } = await mintToken({
        name: 'org-scoped',
        scopes: ['members:read'],
        organizationIds: [organizationId],
      });

      const foreign = '22222222-2222-4222-8222-222222222222';
      const response = await call(`/api/v1/organizations/${foreign}/members`, {
        token,
      });

      expect(response.status).toBe(403);
      expect(response.body?.code).toBe('TOKEN_007');
    });

    it('refuses to scope a token to an organization the creator does not belong to', async () => {
      const response = await call('/api/v1/tokens', {
        method: 'POST',
        token: user.sessionToken,
        body: {
          name: 'foreign-org',
          scopes: ['members:read'],
          organizationIds: ['33333333-3333-4333-8333-333333333333'],
        },
      });

      expect(response.status).toBe(403);
      expect(response.body?.code).toBe('TOKEN_008');
    });
  });

  // --- OAuth discovery -----------------------------------------------------

  describe('OAuth provider for MCP clients', () => {
    it('publishes authorization-server metadata', async () => {
      const response = await fetch(`${baseUrl}/api/auth/.well-known/oauth-authorization-server`);
      expect(response.status).toBe(200);

      const metadata = (await response.json()) as {
        authorization_endpoint?: string;
        token_endpoint?: string;
        registration_endpoint?: string;
        scopes_supported?: string[];
        code_challenge_methods_supported?: string[];
      };

      expect(metadata.authorization_endpoint).toBeTruthy();
      expect(metadata.token_endpoint).toBeTruthy();
      // Dynamic client registration is what lets an MCP client connect without
      // being pre-provisioned.
      expect(metadata.registration_endpoint).toBeTruthy();
      expect(metadata.code_challenge_methods_supported).toContain('S256');
      // The deployment's own catalog, not just the OIDC standard scopes.
      expect(metadata.scopes_supported).toEqual(
        expect.arrayContaining(['openid', 'users:read', 'roles:write']),
      );
    });
  });
});
