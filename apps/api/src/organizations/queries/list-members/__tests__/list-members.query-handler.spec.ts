import { describe, expect, it, vi } from 'vitest';
import { ListMembersQuery } from '../list-members.query';
import { ListMembersQueryHandler } from '../list-members.query-handler';

describe('ListMembersQueryHandler', () => {
  it('asks the repository for the members the search and facet leave', async () => {
    const members = { findMembers: vi.fn().mockResolvedValue([]) };
    const handler = new ListMembersQueryHandler(members as never);

    await handler.execute(
      new ListMembersQuery({ organizationId: 'org1', search: 'ada', roleIds: ['r1'] }),
    );

    expect(members.findMembers).toHaveBeenCalledWith('org1', { search: 'ada', roleIds: ['r1'] });
  });
});
