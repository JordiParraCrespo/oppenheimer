import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { createTestDatabase } from '../../__tests__/integration-services';
import { Session } from '../../auth/database/session.orm-entity';
import { AccessGrantOrmEntity } from '../../authz/database/access-grant.orm-entity';
import { RoleOrmEntity } from '../../roles/database/role.orm-entity';
import { UserRoleOrmEntity } from '../../roles/database/user-role.orm-entity';
import { UserRoleRepository } from '../../roles/database/user-role.repository';
import type { UserRoleRepositoryPort } from '../../roles/database/user-role.repository.port';
import { RoleMapper } from '../../roles/roles.mapper';
import { InvitationOrmEntity } from '../database/invitation.orm-entity';
import { InvitationRepository } from '../database/invitation.repository';
import { MemberOrmEntity } from '../database/member.orm-entity';
import { OrganizationAccessRepository } from '../database/organization-access.repository';

/**
 * What a person keeps in an organization once they are out of it, against the
 * migrated schema: `OrganizationAccessRepository.revokeFor`, which removing a
 * member and leaving both end in; the foreign keys that clean up after an
 * organization is deleted outright; and reopening an invitation whose
 * acceptance was undone.
 */
describe('Organization access (integration)', () => {
  let dataSource: DataSource;
  let userRoles: UserRoleRepository;

  beforeAll(async () => {
    const db = await createTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        Session,
        AccessGrantOrmEntity,
        InvitationOrmEntity,
        MemberOrmEntity,
        RoleOrmEntity,
        UserRoleOrmEntity,
      ],
    });
    await dataSource.initialize();
    userRoles = new UserRoleRepository(
      dataSource.getRepository(UserRoleOrmEntity),
      dataSource.getRepository(RoleOrmEntity),
      new RoleMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  /**
   * A person who is a member of `left` and `kept`, with a role and a grant in
   * `left` and a session that has `left` selected.
   */
  async function seedMembership() {
    const ids = {
      user: randomUUID(),
      left: randomUUID(),
      kept: randomUUID(),
      session: randomUUID(),
    };
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ada', $2, 'Ada', 'L')`,
      [ids.user, `${ids.user}@example.com`],
    );
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Left', $2), ($3, 'Kept', $4)`,
      [ids.left, `left-${ids.left}`, ids.kept, `kept-${ids.kept}`],
    );
    // The membership in `kept`, and — joined earlier, so it would be picked
    // first — the one in `left`, as if Better Auth's delete had not landed yet.
    await dataSource.query(
      `INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
       VALUES ($1, $2, $3, 'member', now() - interval '1 day'), ($4, $5, $3, 'member', now())`,
      [randomUUID(), ids.left, ids.user, randomUUID(), ids.kept],
    );
    const [{ id: roleId }] = await dataSource.query(
      `SELECT "id" FROM "role" WHERE "name" = 'user'`,
    );
    await dataSource.query(
      `INSERT INTO "user_role" ("userId", "roleId", "organizationId") VALUES ($1, $2, $3)`,
      [ids.user, roleId, ids.left],
    );
    await dataSource.query(
      `INSERT INTO "access_grant" ("organizationId", "principalType", "principalId",
                                   "resourceType", "resourceId", "grantedBy")
       VALUES ($1, 'user', $2, 'Project', $3, $2)`,
      [ids.left, ids.user, randomUUID()],
    );
    await dataSource.query(
      `INSERT INTO "session" ("id", "userId", "token", "expiresAt", "activeOrganizationId")
       VALUES ($1, $2, $3, now() + interval '1 day', $4)`,
      [ids.session, ids.user, `token-${ids.session}`, ids.left],
    );
    return ids;
  }

  async function whatRemains(ids: { user: string; left: string; session: string }) {
    const [{ roles, grants }] = await dataSource.query(
      `SELECT (SELECT count(*)::int FROM "user_role"
                WHERE "userId" = $1 AND "organizationId" = $2) AS roles,
              (SELECT count(*)::int FROM "access_grant"
                WHERE "principalId" = $1 AND "organizationId" = $2) AS grants`,
      [ids.user, ids.left],
    );
    const [{ activeOrganizationId }] = await dataSource.query(
      `SELECT "activeOrganizationId" FROM "session" WHERE "id" = $1`,
      [ids.session],
    );
    return { roles, grants, activeOrganizationId };
  }

  it('takes the roles and grants, and moves the session to an organization still held, never the one left', async () => {
    const ids = await seedMembership();

    await new OrganizationAccessRepository(dataSource, userRoles).revokeFor(ids.user, ids.left);

    expect(await whatRemains(ids)).toEqual({
      roles: 0,
      grants: 0,
      activeOrganizationId: ids.kept,
    });
  });

  /**
   * The roles are written by the roles module, through its port, on this
   * revocation's transaction; so a failure later in it leaves
   * the person exactly as they were rather than with no roles but a grant and
   * a session still reaching the organization.
   */
  it('rolls every write back when a later one fails', async () => {
    const ids = await seedMembership();
    const failingAfterTheRoles: UserRoleRepositoryPort = Object.assign(Object.create(userRoles), {
      setRolesForUser: async (
        userId: string,
        roleIds: string[],
        organizationId: string | null,
        manager?: EntityManager,
      ) => {
        await userRoles.setRolesForUser(userId, roleIds, organizationId, manager);
        throw new Error('the next write failed');
      },
    });

    await expect(
      new OrganizationAccessRepository(dataSource, failingAfterTheRoles).revokeFor(
        ids.user,
        ids.left,
      ),
    ).rejects.toThrow('the next write failed');

    expect(await whatRemains(ids)).toEqual({
      roles: 1,
      grants: 1,
      activeOrganizationId: ids.left,
    });
  });

  /**
   * Deleting an organization revokes nothing in code, and needs not to: Better
   * Auth's delete removes the organization row, and the schema takes its role
   * assignments and grants with it and clears every session that had it
   * selected. `e2e/tests/api/organization-membership.spec.ts` drives the same
   * delete through the API.
   */
  it('leaves no role, grant or session selection behind when the organization is deleted', async () => {
    const ids = await seedMembership();

    await dataSource.query(`DELETE FROM "organization" WHERE "id" = $1`, [ids.left]);

    expect(await whatRemains(ids)).toEqual({ roles: 0, grants: 0, activeOrganizationId: null });
  });

  /**
   * An acceptance undone because its role could not be granted puts the
   * invitation back to pending — Better Auth accepts nothing else, so a retry
   * would otherwise find it used up. Only an accepted one moves: a rejected or
   * cancelled answer is the invitee's or the organization's, not ours to undo.
   */
  it('reopens an accepted invitation and closes it again, leaving any other answer alone', async () => {
    const ids = await seedMembership();
    const invite = async (status: string) => {
      const id = randomUUID();
      await dataSource.query(
        `INSERT INTO "invitation" ("id", "organizationId", "email", "role", "status", "inviterId", "expiresAt")
         VALUES ($1, $2, 'invitee@example.com', 'member', $3, $4, now() + interval '7 days')`,
        [id, ids.kept, status, ids.user],
      );
      return id;
    };
    const accepted = await invite('accepted');
    const rejected = await invite('rejected');
    const invitations = new InvitationRepository(dataSource.getRepository(InvitationOrmEntity));

    await invitations.reopen(accepted);
    await invitations.reopen(rejected);

    const statusOf = async (id: string) =>
      (await dataSource.query(`SELECT "status" FROM "invitation" WHERE "id" = $1`, [id]))[0].status;
    expect(await statusOf(accepted)).toBe('pending');
    expect(await statusOf(rejected)).toBe('rejected');

    // And back, when the membership could not be left after all.
    await invitations.markAccepted(accepted);
    await invitations.markAccepted(rejected);
    expect(await statusOf(accepted)).toBe('accepted');
    expect(await statusOf(rejected)).toBe('rejected');
  });
});
