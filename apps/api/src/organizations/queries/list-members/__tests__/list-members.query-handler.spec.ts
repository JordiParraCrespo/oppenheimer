import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignedRole } from '../../../domain/membership.types';
import { ListMembersQuery } from '../list-members.query';
import { ListMembersQueryHandler } from '../list-members.query-handler';

const headers = { cookie: 'session=abc' };
const member = {
  id: 'm1',
  organizationId: 'org1',
  userId: 'u1',
  role: 'owner',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  user: null,
};
const account = {
  id: 'u1',
  name: 'Member One',
  email: 'member@x.com',
  image: null,
  firstName: 'Member',
  lastName: 'One',
  isActive: true,
  emailVerified: true,
};

describe('ListMembersQueryHandler', () => {
  const organizations = { listMembers: vi.fn() };
  const members = { findAccounts: vi.fn(), findAssignedRoles: vi.fn() };
  let handler: ListMembersQueryHandler;
  let assigned: Map<string, AssignedRole[]>;

  const list = (filters: { search?: string; roleIds?: string[] } = {}) =>
    handler.execute(
      new ListMembersQuery({
        headers,
        organizationId: 'org1',
        search: filters.search,
        roleIds: filters.roleIds,
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    assigned = new Map();
    organizations.listMembers.mockResolvedValue([member]);
    members.findAccounts.mockResolvedValue([account]);
    members.findAssignedRoles.mockImplementation(async () => assigned);
    handler = new ListMembersQueryHandler(organizations as never, members as never);
  });

  it('puts the account behind each member on it', async () => {
    const result = await list();

    expect(result).toHaveLength(1);
    expect(result[0].user).toMatchObject({ id: 'u1', name: 'Member One', email: 'member@x.com' });
    // No filter, no role lookup.
    expect(members.findAssignedRoles).not.toHaveBeenCalled();
  });

  it('keeps a member holding any of the requested roles', async () => {
    assigned.set('u1', [{ id: 'role-admin', name: 'admin' }]);
    expect(await list({ roleIds: ['role-superadmin', 'role-admin'] })).toHaveLength(1);
  });

  it('drops a member holding none of them', async () => {
    assigned.set('u1', [{ id: 'role-user', name: 'user' }]);
    expect(await list({ roleIds: ['role-superadmin'] })).toHaveLength(0);
  });

  it('drops a member with no assigned role at all', async () => {
    expect(await list({ roleIds: ['role-admin'] })).toHaveLength(0);
  });

  it('applies the search and the role facet together, not either/or', async () => {
    assigned.set('u1', [{ id: 'role-admin', name: 'admin' }]);

    // Holds the role, but the search does not match — one filter passing is
    // not enough, or a facet would widen the list the search narrowed.
    expect(await list({ search: 'nobody', roleIds: ['role-admin'] })).toHaveLength(0);
    expect(await list({ search: 'Member One', roleIds: ['role-admin'] })).toHaveLength(1);
  });

  it('matches the search against an assigned role name', async () => {
    assigned.set('u1', [{ id: 'role-admin', name: 'admin' }]);
    expect(await list({ search: 'admin' })).toHaveLength(1);
  });
});
