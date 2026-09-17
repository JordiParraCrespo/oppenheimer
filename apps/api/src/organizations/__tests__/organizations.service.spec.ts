import type { IncomingHttpHeaders } from 'node:http';
import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/auth', () => ({
  auth: {
    api: {
      createOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      deleteOrganization: vi.fn(),
      setActiveOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getSession: vi.fn(),
      getFullOrganization: vi.fn(),
      checkOrganizationSlug: vi.fn(),
      listMembers: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveOrganization: vi.fn(),
      getActiveMember: vi.fn(),
      createTeam: vi.fn(),
      addTeamMember: vi.fn(),
      setActiveTeam: vi.fn(),
    },
  },
}));

import { auth } from '../../auth/auth';
import { OrganizationsService } from '../organizations.service';

const api = auth.api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const headers: IncomingHttpHeaders = { cookie: 'session=abc' };

const orgRecord = {
  id: 'org1',
  name: 'Acme',
  slug: 'acme',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const otherOrgRecord = {
  id: 'org2',
  name: 'Other',
  slug: 'other',
  createdAt: '2024-01-02T00:00:00.000Z',
};
const workspaceRecord = {
  id: 'team1',
  name: 'General',
  organizationId: 'org1',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const memberRecord = {
  id: 'm1',
  organizationId: 'org1',
  userId: 'u1',
  role: 'owner',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  /**
   * Rows the `user_role` join would return, as raw shapes — the service reads
   * them through a query builder, so a repository double is not enough.
   */
  const assignments: { userId: string; id: string; name: string }[] = [];
  const users = {
    findOne: vi.fn().mockResolvedValue({ email: 'member@x.com' }),
    find: vi.fn().mockResolvedValue([
      {
        id: 'u1',
        name: 'Member One',
        email: 'member@x.com',
        image: null,
        firstName: 'Member',
        lastName: 'One',
        isActive: true,
        emailVerified: true,
      },
    ]),
  };
  const userRoleRecords = {
    createQueryBuilder: () => {
      const builder = {
        innerJoin: () => builder,
        select: () => builder,
        addSelect: () => builder,
        where: () => builder,
        andWhere: () => builder,
        getRawMany: async () => assignments,
      };
      return builder;
    },
  };
  const roles = {
    findOneByName: vi.fn().mockResolvedValue({
      isNone: () => false,
      unwrap: () => ({ id: 'system-role' }),
    }),
  };
  const userRoles = { setRolesForUser: vi.fn().mockResolvedValue(undefined) };
  const memberRecords = { findOne: vi.fn().mockResolvedValue(null) };
  const sessions = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
  const accessGrants = { delete: vi.fn().mockResolvedValue({ affected: 0 }) };

  beforeEach(() => {
    vi.clearAllMocks();
    users.findOne.mockResolvedValue({ email: 'member@x.com' });
    users.find.mockResolvedValue([
      {
        id: 'u1',
        name: 'Member One',
        email: 'member@x.com',
        image: null,
        firstName: 'Member',
        lastName: 'One',
        isActive: true,
        emailVerified: true,
      },
    ]);
    assignments.length = 0;
    roles.findOneByName.mockResolvedValue({
      isNone: () => false,
      unwrap: () => ({ id: 'system-role' }),
    });
    memberRecords.findOne.mockResolvedValue(null);
    service = new OrganizationsService(
      users as never,
      userRoleRecords as never,
      roles as never,
      userRoles as never,
      memberRecords as never,
      sessions as never,
      accessGrants as never,
    );
  });

  describe('create', () => {
    it('uses the provided slug', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      await service.create(headers, { name: 'Acme', slug: 'custom-slug' });
      expect(api.createOrganization.mock.calls[0][0].body.slug).toBe('custom-slug');
    });

    it('generates a slug from the name when none is provided', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      await service.create(headers, { name: 'My Great Org!' });

      const slug: string = api.createOrganization.mock.calls[0][0].body.slug;
      // slugified base + '-' + 8 hex chars
      expect(slug).toMatch(/^my-great-org-[0-9a-f]{8}$/);
    });

    // "workspace", not the "org" this used to say: the slug rule is now one
    // value object shared with the personal workspace sign-up provisions
    // (`OrganizationSlug.derive`), and the two used to disagree about the
    // fallback. "workspace" is what the console calls these.
    it('falls back to "workspace" when the name has no alphanumerics', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      await service.create(headers, { name: '***' });
      const slug: string = api.createOrganization.mock.calls[0][0].body.slug;
      expect(slug).toMatch(/^workspace-[0-9a-f]{8}$/);
    });

    it('maps the created organization', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      const result = await service.create(headers, { name: 'Acme' });
      expect(result.id).toBe('org1');
    });

    /**
     * The bug this exists to stop: Better Auth's `owner` membership is not what
     * the app's routes check, so an organization created without the
     * org-scoped application role is one its creator owns and cannot read.
     */
    it('grants the creator the org-scoped role that opens the organization', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      api.getSession.mockResolvedValue({ user: { id: 'u1' } });
      api.createTeam.mockResolvedValue({ ...workspaceRecord });

      await service.create(headers, { name: 'Acme' });

      expect(roles.findOneByName).toHaveBeenCalledWith('owner', null);
      expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', ['system-role'], 'org1');
    });

    it('gives the organization a default workspace with its creator in it', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      api.getSession.mockResolvedValue({ user: { id: 'u1' } });
      api.createTeam.mockResolvedValue({ ...workspaceRecord });

      await service.create(headers, { name: 'Acme' });

      expect(api.createTeam.mock.calls[0][0].body).toEqual({
        name: 'General',
        organizationId: 'org1',
      });
      expect(api.addTeamMember.mock.calls[0][0].body).toEqual({
        teamId: 'team1',
        userId: 'u1',
      });
      expect(api.setActiveTeam.mock.calls[0][0].body).toEqual({ teamId: 'team1' });
    });

    /**
     * The failure mode this whole change exists to remove, reached from the
     * other side: an organization that exists, is owned, and cannot be opened.
     */
    it('discards the organization when the role that opens it cannot be written', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      api.getSession.mockResolvedValue({ user: { id: 'u1' } });
      const failure = new Error('role store unavailable');
      userRoles.setRolesForUser.mockRejectedValueOnce(failure);

      await expect(service.create(headers, { name: 'Acme' })).rejects.toBe(failure);

      expect(api.deleteOrganization.mock.calls[0][0].body).toEqual({
        organizationId: 'org1',
      });
      // No half-built organization left behind for the caller to trip over.
      expect(api.createTeam).not.toHaveBeenCalled();
    });

    it('reports the original failure even when the cleanup itself fails', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      api.getSession.mockResolvedValue({ user: { id: 'u1' } });
      const failure = new Error('role store unavailable');
      userRoles.setRolesForUser.mockRejectedValueOnce(failure);
      api.deleteOrganization.mockRejectedValueOnce(new Error('delete failed too'));

      // The caller needs the reason they could not create a workspace, not a
      // second-order error about tidying up after it.
      await expect(service.create(headers, { name: 'Acme' })).rejects.toBe(failure);
    });

    /**
     * The workspace is a convenience; the organization and the role that opens
     * it are not. Failing the request when the team could not be made would
     * tell the caller the organization does not exist when it does.
     */
    it('still returns the organization when the default workspace cannot be made', async () => {
      api.createOrganization.mockResolvedValue(orgRecord);
      api.getSession.mockResolvedValue({ user: { id: 'u1' } });
      api.createTeam.mockRejectedValue(new Error('teams are unavailable'));

      const result = await service.create(headers, { name: 'Acme' });

      expect(result.id).toBe('org1');
      expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', ['system-role'], 'org1');
    });
  });

  it('updates an organization', async () => {
    api.updateOrganization.mockResolvedValue(orgRecord);
    await service.update(headers, 'org1', { name: 'Acme 2' });
    expect(api.updateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { data: { name: 'Acme 2' }, organizationId: 'org1' },
      }),
    );
  });

  it('deletes an organization', async () => {
    api.deleteOrganization.mockResolvedValue(orgRecord);
    const result = await service.delete(headers, 'org1');
    expect(result.id).toBe('org1');
    expect(api.deleteOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ body: { organizationId: 'org1' } }),
    );
  });

  describe('setActive', () => {
    it('maps the organization when Better Auth returns one', async () => {
      api.setActiveOrganization.mockResolvedValue(orgRecord);
      const result = await service.setActive(headers, 'org1');
      expect(result?.id).toBe('org1');
    });

    it('returns null when Better Auth returns a falsy result (cleared active org)', async () => {
      api.setActiveOrganization.mockResolvedValue(null);
      const result = await service.setActive(headers, 'org1');
      expect(result).toBeNull();
    });
  });

  it('lists organizations', async () => {
    api.listOrganizations.mockResolvedValue([orgRecord]);
    api.getSession.mockResolvedValue(null);
    const result = await service.list(headers);
    expect(result).toHaveLength(1);
  });

  it('puts the session active organization first for organization-aware screens', async () => {
    api.listOrganizations.mockResolvedValue([orgRecord, otherOrgRecord]);
    api.getSession.mockResolvedValue({ session: { activeOrganizationId: 'org2' } });

    const result = await service.list(headers);

    expect(result.map((organization) => organization.id)).toEqual(['org2', 'org1']);
  });

  describe('getFull', () => {
    it('maps a full organization', async () => {
      api.getFullOrganization.mockResolvedValue({
        ...orgRecord,
        members: [memberRecord],
      });
      const result = await service.getFull(headers, 'org1');
      expect(result?.members).toHaveLength(1);
    });

    it('returns null when no organization is found', async () => {
      api.getFullOrganization.mockResolvedValue(null);
      expect(await service.getFull(headers, 'org1')).toBeNull();
    });
  });

  describe('checkSlug', () => {
    it('returns available:true when Better Auth does not throw', async () => {
      api.checkOrganizationSlug.mockResolvedValue({ status: true });
      expect(await service.checkSlug(headers, 'free-slug')).toEqual({
        available: true,
      });
    });

    it('returns available:false when Better Auth throws an APIError (slug taken)', async () => {
      api.checkOrganizationSlug.mockRejectedValue(
        new APIError('BAD_REQUEST', { message: 'taken' }),
      );
      expect(await service.checkSlug(headers, 'taken-slug')).toEqual({
        available: false,
      });
    });

    it('rethrows non-APIError failures', async () => {
      api.checkOrganizationSlug.mockRejectedValue(new Error('network down'));
      await expect(service.checkSlug(headers, 'x')).rejects.toThrow('network down');
    });
  });

  describe('members', () => {
    it('lists members unwrapping the `{ members }` envelope', async () => {
      api.listMembers.mockResolvedValue({ members: [memberRecord] });
      const result = await service.listMembers(headers, 'org1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
      expect(result[0].user).toMatchObject({
        id: 'u1',
        name: 'Member One',
        email: 'member@x.com',
      });
    });

    it('keeps a member holding any of the requested roles', async () => {
      api.listMembers.mockResolvedValue({ members: [memberRecord] });
      assignments.push({ userId: 'u1', id: 'role-admin', name: 'admin' });

      const result = await service.listMembers(headers, 'org1', {
        roleIds: ['role-superadmin', 'role-admin'],
      });
      expect(result).toHaveLength(1);
    });

    it('drops a member holding none of them', async () => {
      api.listMembers.mockResolvedValue({ members: [memberRecord] });
      assignments.push({ userId: 'u1', id: 'role-user', name: 'user' });

      const result = await service.listMembers(headers, 'org1', {
        roleIds: ['role-superadmin'],
      });
      expect(result).toHaveLength(0);
    });

    it('drops a member with no assigned role at all', async () => {
      api.listMembers.mockResolvedValue({ members: [memberRecord] });

      const result = await service.listMembers(headers, 'org1', {
        roleIds: ['role-admin'],
      });
      expect(result).toHaveLength(0);
    });

    it('applies the search and the role facet together, not either/or', async () => {
      api.listMembers.mockResolvedValue({ members: [memberRecord] });
      assignments.push({ userId: 'u1', id: 'role-admin', name: 'admin' });

      // Holds the role, but the search does not match — one filter passing is
      // not enough, or a facet would widen the list the search narrowed.
      expect(
        await service.listMembers(headers, 'org1', {
          search: 'nobody',
          roleIds: ['role-admin'],
        }),
      ).toHaveLength(0);

      expect(
        await service.listMembers(headers, 'org1', {
          search: 'Member One',
          roleIds: ['role-admin'],
        }),
      ).toHaveLength(1);
    });

    it('matches the search against an assigned role name', async () => {
      api.listMembers.mockResolvedValue({ members: [memberRecord] });
      assignments.push({ userId: 'u1', id: 'role-admin', name: 'admin' });

      expect(await service.listMembers(headers, 'org1', { search: 'admin' })).toHaveLength(1);
    });

    it('adds a member forwarding role and teamId', async () => {
      api.addMember.mockResolvedValue({ ...memberRecord, role: 'member' });
      await service.addMember(headers, 'org1', {
        userId: 'u1',
        role: 'member',
        teamId: 'team1',
      });
      expect(api.addMember).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            userId: 'u1',
            role: 'member',
            organizationId: 'org1',
            teamId: 'team1',
          },
        }),
      );
      expect(roles.findOneByName).toHaveBeenCalledWith('user', null);
      expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', ['system-role'], 'org1');
    });

    it('removes a member unwrapping the `{ member }` envelope', async () => {
      api.removeMember.mockResolvedValue({ member: memberRecord });
      const result = await service.removeMember(headers, 'org1', 'm1');
      expect(result.id).toBe('m1');
      expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', [], 'org1');
      expect(accessGrants.delete).toHaveBeenCalledWith({
        organizationId: 'org1',
        principalType: 'user',
        principalId: 'u1',
      });
      expect(sessions.update).toHaveBeenCalledWith(
        { userId: 'u1', activeOrganizationId: 'org1' },
        { activeOrganizationId: null, activeTeamId: null },
      );
    });

    it('updates a member role', async () => {
      api.updateMemberRole.mockResolvedValue(memberRecord);
      await service.updateMemberRole(headers, 'org1', 'm1', 'admin');
      expect(api.updateMemberRole).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { memberId: 'm1', role: 'admin', organizationId: 'org1' },
        }),
      );
      expect(roles.findOneByName).toHaveBeenCalledWith('owner', null);
      expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', ['system-role'], 'org1');
    });

    it('leaves an organization', async () => {
      api.leaveOrganization.mockResolvedValue(memberRecord);
      const result = await service.leave(headers, 'org1');
      expect(result.id).toBe('m1');
      expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u1', [], 'org1');
    });

    it('gets the active member', async () => {
      api.getActiveMember.mockResolvedValue(memberRecord);
      const result = await service.getActiveMember(headers);
      expect(result.userId).toBe('u1');
    });
  });
});
