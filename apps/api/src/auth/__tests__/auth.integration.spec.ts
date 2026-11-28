import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { useTestDatabase, useTestRedis } from '../../__tests__/integration-services';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    // The migrated schema, not `synchronize`: sign-up's side effects need the
    // system roles the baseline seeds, and the personal workspace is granted
    // its `owner` row.
    await useTestDatabase();
    await useTestRedis();

    process.env.BETTER_AUTH_SECRET = 'integration-test-secret-value-32-chars';

    // Import AppModule (and therefore the Better Auth instance, which reads the
    // database config at module load) only after the env vars are set.
    const { AppModule } = await import('../../app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });

    // Mirror `main.ts`: the prefix, URI versioning and the pipes are part of
    // the pipeline a request goes through, and one of the tests below is about
    // which of them answers first.
    const { VersioningType } = await import('@nestjs/common');
    const { SanitizePipe } = await import('@oppenheimer/backend-core');
    const { ZodValidationPipe } = await import('nestjs-zod');

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    dataSource = moduleRef.get(DataSource);
  }, 180000);

  afterAll(async () => {
    await app?.close();
    // `app.close()` does not reach it: see `emailQueue`.
    const { emailQueue } = await import('../infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
  });

  describe('the session sign-up returns', () => {
    /**
     * Sign-up provisions the personal workspace, and the session it hands back
     * has to work in it. Better Auth picks a session's organization when the
     * row is written, and the provisioning hook runs after the sign-up commits,
     * so the session started with `activeOrganizationId = null` and held only
     * the global `user` role: every org-scoped route answered 403 to the
     * workspace's own owner. Provisioning points the account's org-less
     * sessions at the new workspace in the same transaction.
     */
    it('is already in the workspace sign-up provisioned', async () => {
      const email = `signup-${randomUUID()}@example.com`;
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'Integration-test-password-1',
          name: 'New Account',
          firstName: 'New',
          lastName: 'Account',
        }),
      });

      expect(response.ok).toBe(true);
      const sessionToken = response.headers.get('set-auth-token');
      expect(sessionToken).toBeTruthy();
      const { user } = (await response.json()) as { user: { id: string } };

      const [membership] = await dataSource.query(
        `SELECT "organizationId" FROM "member" WHERE "userId" = $1`,
        [user.id],
      );
      expect(membership?.organizationId).toBeTruthy();

      const sessions = await dataSource.query(
        `SELECT "activeOrganizationId" FROM "session" WHERE "userId" = $1`,
        [user.id],
      );
      expect(sessions).toHaveLength(1);
      expect(sessions[0].activeOrganizationId).toBe(membership.organizationId);

      // And the consequence, through the guards: an org-scoped route answers
      // about the resource rather than refusing the caller.
      const probe = await fetch(`${baseUrl}/api/v1/sessions/${randomUUID()}`, {
        headers: { accept: 'application/json', authorization: `Bearer ${sessionToken}` },
      });
      expect(probe.status).toBe(404);
      expect(((await probe.json()) as { code?: string }).code).toBe('SESSIONS_001');
    });
  });

  describe('a session’s own update', () => {
    /**
     * `delegated` marks a credential bridge, which "Active sessions" leaves
     * out. Were it a field `POST /update-session` accepts, a stolen cookie
     * could set it and drop out of the list that exists to expose it.
     */
    it('cannot mark the session delegated, so it stays in the list', async () => {
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: `hide-${randomUUID()}@example.com`,
          password: 'Integration-test-password-1',
          name: 'Hide Me',
          firstName: 'Hide',
          lastName: 'Me',
        }),
      });
      expect(response.ok).toBe(true);
      const token = response.headers.get('set-auth-token') ?? '';
      const { user } = (await response.json()) as { user: { id: string } };

      await fetch(`${baseUrl}/api/auth/update-session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ delegated: true, delegatedCredentialId: 'x' }),
      });

      const rows = await dataSource.query(
        `SELECT "delegated", "delegatedCredentialId" FROM "session" WHERE "userId" = $1`,
        [user.id],
      );
      expect(rows).toEqual([{ delegated: false, delegatedCredentialId: null }]);
      const listed = await fetch(`${baseUrl}/api/v1/profile/sessions`, {
        headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      });
      expect(((await listed.json()) as unknown[]).length).toBe(1);
    });
  });

  describe('a ban made straight through Better Auth', () => {
    async function signUp(): Promise<{ id: string; email: string; token: string }> {
      const email = `ban-${randomUUID()}@example.com`;
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'Integration-test-password-1',
          name: 'Some One',
          firstName: 'Some',
          lastName: 'One',
        }),
      });
      expect(response.ok).toBe(true);
      const { user } = (await response.json()) as { user: { id: string } };
      return { id: user.id, email, token: response.headers.get('set-auth-token') ?? '' };
    }

    async function adminToken(): Promise<string> {
      const admin = await signUp();
      await dataSource.query(`UPDATE "user" SET "role" = 'admin' WHERE "id" = $1`, [admin.id]);
      // A fresh session, so the role the plugin checks is read after the update.
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: admin.email, password: 'Integration-test-password-1' }),
      });
      expect(response.ok).toBe(true);
      return response.headers.get('set-auth-token') ?? '';
    }

    const adminCall = (path: string, token: string, userId: string) =>
      fetch(`${baseUrl}/api/auth/admin/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });

    it("rotates the account's delegated sessions on ban and on unban", async () => {
      const { DELEGATED_SESSION } = await import('../auth.di-tokens');
      const delegated = app.get<{ invalidateForUser(userId: string): Promise<void> }>(
        DELEGATED_SESSION,
      );
      const rotate = vi.spyOn(delegated, 'invalidateForUser');
      const target = await signUp();
      const token = await adminToken();

      // Regression: only the admin module's ban rotated the generation, so a ban
      // through Better Auth's own endpoint left cached delegated sessions alive.
      expect((await adminCall('ban-user', token, target.id)).ok).toBe(true);
      expect(rotate).toHaveBeenCalledWith(target.id);

      rotate.mockClear();
      expect((await adminCall('unban-user', token, target.id)).ok).toBe(true);
      expect(rotate).toHaveBeenCalledWith(target.id);
      rotate.mockRestore();
    });

    it('rotates nothing for a ban the plugin refused', async () => {
      const { DELEGATED_SESSION } = await import('../auth.di-tokens');
      const delegated = app.get<{ invalidateForUser(userId: string): Promise<void> }>(
        DELEGATED_SESSION,
      );
      const rotate = vi.spyOn(delegated, 'invalidateForUser');
      const caller = await signUp();
      const target = await signUp();

      // Not an admin: the plugin refuses, and nothing is rotated.
      expect((await adminCall('ban-user', caller.token, target.id)).ok).toBe(false);
      expect(rotate).not.toHaveBeenCalled();
      rotate.mockRestore();
    });
  });
  async function signUpAs(prefix: string): Promise<{ id: string; email: string; token: string }> {
    const email = `${prefix}-${randomUUID()}@example.com`;
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Integration-test-password-1',
        name: 'Some One',
        firstName: 'Some',
        lastName: 'One',
      }),
    });
    expect(response.ok).toBe(true);
    const { user } = (await response.json()) as { user: { id: string } };
    return { id: user.id, email, token: response.headers.get('set-auth-token') ?? '' };
  }

  /** A fresh session, so the platform role the admin plugin checks is read after the update. */
  async function signedInWithRole(role: string): Promise<{ id: string; token: string }> {
    const account = await signUpAs(role);
    await dataSource.query(`UPDATE "user" SET "role" = $1 WHERE "id" = $2`, [role, account.id]);
    const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: 'Integration-test-password-1' }),
    });
    expect(response.ok).toBe(true);
    return { id: account.id, token: response.headers.get('set-auth-token') ?? '' };
  }

  describe('Better Auth’s organization routes', () => {
    /**
     * Its own roster writes change who is in an organization without the
     * application role that goes with it: a member removed or demoted there
     * kept their `owner` row. The façade is the one door
     * (`closed-auth-paths.util.ts`).
     */
    it('answer 404 to a client for every write of the roster, invitations or teams', async () => {
      const { CLOSED_ORGANIZATION_PATHS } = await import(
        '../infrastructure/closed-auth-paths.util'
      );
      const caller = await signUpAs('closed');
      const [{ organizationId }] = await dataSource.query(
        `SELECT "organizationId" FROM "member" WHERE "userId" = $1`,
        [caller.id],
      );

      expect(CLOSED_ORGANIZATION_PATHS).toContain('/organization/remove-member');
      for (const path of CLOSED_ORGANIZATION_PATHS) {
        const response = await fetch(`${baseUrl}/api/auth${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${caller.token}` },
          body: JSON.stringify({ organizationId, memberIdOrEmail: caller.email, role: 'member' }),
        });
        expect({ path, status: response.status }).toEqual({ path, status: 404 });
      }

      // Nothing was written: still the one owner of their own workspace.
      const members = await dataSource.query(
        `SELECT "userId", "role" FROM "member" WHERE "organizationId" = $1`,
        [organizationId],
      );
      expect(members).toEqual([{ userId: caller.id, role: 'owner' }]);
    });

    it('keep the reads open', async () => {
      const caller = await signUpAs('reads');
      const response = await fetch(`${baseUrl}/api/auth/organization/list`, {
        headers: { authorization: `Bearer ${caller.token}` },
      });
      expect(response.status).toBe(200);
      expect((await response.json()) as unknown[]).toHaveLength(1);
    });

    // `disabledPaths` is checked by Better Auth's router alone; the façade's
    // gateways call `auth.api.*`, which must keep working.
    it('still serve the façade, which calls them on the server', async () => {
      const caller = await signUpAs('facade');
      const [{ organizationId }] = await dataSource.query(
        `SELECT "organizationId" FROM "member" WHERE "userId" = $1`,
        [caller.id],
      );
      const response = await fetch(
        `${baseUrl}/api/v1/organizations/${organizationId}/invitations`,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: `Bearer ${caller.token}`,
          },
          body: JSON.stringify({ email: `invitee-${randomUUID()}@example.com` }),
        },
      );
      expect(response.status).toBe(201);
    });
  });

  describe('the admin plugin’s platform roles', () => {
    const setRole = (token: string, userId: string, role: string) =>
      fetch(`${baseUrl}/api/auth/admin/set-role`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, role }),
      });
    const roleOf = async (userId: string) =>
      (await dataSource.query(`SELECT "role" FROM "user" WHERE "id" = $1`, [userId]))[0].role;

    // Regression: Better Auth's built-in `admin` holds `set-role`, so an admin
    // could make itself `superadmin` and take `impersonate-admins` with it.
    it('refuse an admin promoting itself to superadmin, straight or through the façade', async () => {
      const admin = await signedInWithRole('admin');

      expect((await setRole(admin.token, admin.id, 'superadmin')).status).toBe(403);
      const facade = await fetch(`${baseUrl}/api/v1/admin/users/${admin.id}/role`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${admin.token}`,
        },
        body: JSON.stringify({ role: 'superadmin' }),
      });
      expect(facade.status).toBe(403);
      expect(((await facade.json()) as { code?: string }).code).toBe('ADMIN_003');
      expect(await roleOf(admin.id)).toBe('admin');
    });

    it('leave setting a role to a superadmin', async () => {
      const superadmin = await signedInWithRole('superadmin');
      const target = await signUpAs('promoted');

      expect((await setRole(superadmin.token, target.id, 'admin')).status).toBe(200);
      expect(await roleOf(target.id)).toBe('admin');
    });
  });
});
