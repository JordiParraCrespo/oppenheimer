import { describe, expect, it, vi } from 'vitest';
import { RemoveMemberCommand } from '../remove-member.command';
import { RemoveMemberCommandHandler } from '../remove-member.command-handler';

describe('RemoveMemberCommandHandler', () => {
  it('removes the member and revokes what the organization gave them', async () => {
    const headers = { cookie: 'session=abc' };
    const member = { id: 'm1', organizationId: 'org1', userId: 'u1', role: 'member', user: null };
    const organizations = { removeMember: vi.fn().mockResolvedValue(member) };
    const members = { findAccounts: vi.fn().mockResolvedValue([]) };
    const membershipAccess = { revoke: vi.fn().mockResolvedValue(undefined) };
    const handler = new RemoveMemberCommandHandler(
      organizations as never,
      members as never,
      membershipAccess as never,
    );

    const result = await handler.execute(
      new RemoveMemberCommand({ headers, organizationId: 'org1', memberIdOrEmail: 'm1' }),
    );

    expect(result.id).toBe('m1');
    expect(organizations.removeMember).toHaveBeenCalledWith(headers, 'org1', 'm1');
    expect(membershipAccess.revoke).toHaveBeenCalledWith('u1', 'org1');
  });
});
