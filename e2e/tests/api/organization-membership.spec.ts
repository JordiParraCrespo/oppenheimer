import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { query } from '../../support/db';
import { createOrganization } from '../../support/web';

test.describe('deleting an organization', () => {
  /**
   * The API's delete is Better Auth's, which removes the organization row and
   * nothing the app keeps beside it; the schema has to take those with it, or
   * a former owner keeps a role, and a session keeps pointing, at nothing.
   */
  test('leaves no org-scoped role or session selection behind', async () => {
    const { api, userId } = await signedUpContext('deleteowner');
    const organizationId = await createOrganization(api, 'Short-lived');
    const activated = await api.post(`/api/v1/organizations/${organizationId}/set-active`);
    expect(activated.ok(), 'selecting the workspace should succeed').toBe(true);

    const deleted = await api.delete(`/api/v1/organizations/${organizationId}`);
    expect(deleted.status()).toBe(200);

    const [{ roles }] = await query<{ roles: number }>(
      `SELECT count(*)::int AS roles FROM "user_role" WHERE "organizationId" = $1`,
      [organizationId],
    );
    expect(roles).toBe(0);
    // Every workspace is made with an Unassigned project; it goes with it.
    const [{ projects }] = await query<{ projects: number }>(
      `SELECT count(*)::int AS projects FROM "project" WHERE "organizationId" = $1`,
      [organizationId],
    );
    expect(projects).toBe(0);
    const sessions = await query<{ activeOrganizationId: string | null }>(
      `SELECT "activeOrganizationId" FROM "session" WHERE "userId" = $1`,
      [userId],
    );
    expect(sessions.map((s) => s.activeOrganizationId)).not.toContain(organizationId);

    await api.dispose();
  });
});
