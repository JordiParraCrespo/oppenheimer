import { describe, expect, it, vi } from 'vitest';
import { AddMemberCommand } from '../add-member.command';
import { AddMemberCommandHandler } from '../add-member.command-handler';

describe('AddMemberCommandHandler', () => {
  it('adds the member and grants the role their organization role stands for', async () => {
    const headers = { cookie: 'session=abc' };
    const member = { id: 'm1', organizationId: 'org1', userId: 'u1', role: 'member', user: null };
    const organizations = { addMember: vi.fn().mockResolvedValue(member) };
    const members = { findAccounts: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Ada' }]) };
    const membershipAccess = { grant: vi.fn().mockResolvedValue(undefined) };
    const handler = new AddMemberCommandHandler(
      organizations as never,
      members as never,
      membershipAccess as never,
    );
    const input = { userId: 'u1', role: 'member' as const, teamId: 'team1' };

    const result = await handler.execute(
      new AddMemberCommand({ headers, organizationId: 'org1', input }),
    );

    expect(organizations.addMember).toHaveBeenCalledWith(headers, 'org1', input);
    expect(membershipAccess.grant).toHaveBeenCalledWith('u1', 'org1', 'member');
    expect(result.user).toMatchObject({ id: 'u1', name: 'Ada' });
  });
});
