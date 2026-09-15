import { expect, test } from '@playwright/test';
import { newContext, signedUpContext } from '../../support/auth';
import { findUserByEmail } from '../../support/db';

/**
 * What a plain, self-registered user may do to *other* people's records.
 *
 * The default role grants no platform User permissions. Self-service edits
 * use /profile, while explicit conditional User grants are checked per row.
 */
test.describe('authorization boundaries for a default user', () => {
  test('cannot escalate their own role to admin', async () => {
    const { api, user, userId } = await signedUpContext('escalate');

    // Default users edit through /profile, not the platform User routes.
    const response = await api.patch(`/api/v1/users/${userId}`, {
      data: { firstName: 'Renamed', role: 'admin' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
    expect(
      (await findUserByEmail(user.email))?.role,
      'a self-service profile update must never confer a privilege',
    ).toBe('user');

    // And the escalation is not merely cosmetic in the response: the admin
    // plugin gates on this exact column, so it must still refuse them.
    const adminPlugin = await api.get('/api/auth/admin/list-users?limit=1', {
      failOnStatusCode: false,
    });
    expect(adminPlugin.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('cross-user writes', () => {
  test("cannot modify another user's profile", async () => {
    const { user: victim, userId: victimId } = await signedUpContext('crossvictim');
    const { api } = await signedUpContext('crossattacker');

    const response = await api.patch(`/api/v1/users/${victimId}`, {
      data: { firstName: 'Overwritten' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
    expect((await findUserByEmail(victim.email))?.firstName).not.toBe('Overwritten');
  });
});

test.describe('user directory exposure', () => {
  test('cannot list every user in the deployment', async () => {
    const { api } = await signedUpContext('directory');

    const response = await api.get('/api/v1/users?limit=100', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
  });
});

test.describe('boundaries that do hold', () => {
  test('cannot delete another user', async () => {
    const { userId: victimId } = await signedUpContext('delvictim');
    const { api } = await signedUpContext('delattacker');

    const response = await api.delete(`/api/v1/users/${victimId}`, {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
  });

  test('cannot reach the Better Auth admin plugin', async () => {
    const { api } = await signedUpContext('adminplugin');

    const response = await api.get('/api/auth/admin/list-users?limit=1', {
      failOnStatusCode: false,
    });

    expect(response.status(), 'the admin plugin is gated on the user role').toBeGreaterThanOrEqual(
      400,
    );
  });

  test('cannot impersonate another user', async () => {
    const { userId: victimId } = await signedUpContext('impvictim');
    const { api } = await signedUpContext('impattacker');

    const response = await api.post('/api/auth/admin/impersonate-user', {
      data: { userId: victimId },
      failOnStatusCode: false,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('anonymous callers cannot touch the user routes at all', async () => {
    const api = await newContext();
    const { userId } = await signedUpContext('anonvictim');

    for (const call of [
      api.get('/api/v1/users', { failOnStatusCode: false }),
      api.get(`/api/v1/users/${userId}`, { failOnStatusCode: false }),
      api.patch(`/api/v1/users/${userId}`, {
        data: { firstName: 'X' },
        failOnStatusCode: false,
      }),
      api.delete(`/api/v1/users/${userId}`, { failOnStatusCode: false }),
    ]) {
      expect((await call).status()).toBe(401);
    }
  });
});
