import type { IncomingHttpHeaders } from 'node:http';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembershipAccessPolicy } from '../../../application/membership-access.policy';
import { UpdateMemberRoleCommand } from '../update-member-role.command';
import { UpdateMemberRoleCommandHandler } from '../update-member-role.command-handler';

const headers: IncomingHttpHeaders = { cookie: 'session=abc' };

describe('UpdateMemberRoleCommandHandler', () => {
  const organizations = { updateMemberRole: vi.fn() };
  const members = { findMembershipById: vi.fn() };
  const membershipAccess = {
    reassign: vi.fn(async (_entry: unknown, write: () => Promise<unknown>) => write()),
  };
  let handler: UpdateMemberRoleCommandHandler;

  const change = (role: string) =>
    handler.execute(
      new UpdateMemberRoleCommand({ headers, organizationId: 'org1', memberId: 'm1', role }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    members.findMembershipById.mockResolvedValue(Some({ id: 'm1', userId: 'u1', role: 'member' }));
    organizations.updateMemberRole.mockResolvedValue({
      id: 'm1',
      organizationId: 'org1',
      userId: 'u1',
      role: 'admin',
    });
    handler = new UpdateMemberRoleCommandHandler(
      organizations as never,
      members as never,
      membershipAccess as unknown as MembershipAccessPolicy,
    );
  });

  it("reassigns the member named by the row, with Better Auth's change as the write", async () => {
    expect(await change('admin')).toBe('m1');

    expect(membershipAccess.reassign).toHaveBeenCalledWith(
      { userId: 'u1', organizationId: 'org1', role: 'admin' },
      expect.any(Function),
    );
    expect(organizations.updateMemberRole).toHaveBeenCalledWith(headers, 'org1', 'm1', 'admin');
  });

  it('refuses a member that is not in the organization before touching any role', async () => {
    members.findMembershipById.mockResolvedValue(None);

    await expect(change('admin')).rejects.toMatchObject({ code: 'ORG_005' });
    expect(membershipAccess.reassign).not.toHaveBeenCalled();
    expect(organizations.updateMemberRole).not.toHaveBeenCalled();
  });
});
