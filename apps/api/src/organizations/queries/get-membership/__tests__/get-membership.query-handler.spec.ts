import { None, type Option, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { Membership } from '../../../domain/membership.types';
import { GetMembershipQuery } from '../get-membership.query';
import { GetMembershipQueryHandler } from '../get-membership.query-handler';

const membership: Membership = {
  id: 'm1',
  organizationId: 'org-b',
  userId: 'u1',
  role: 'owner',
  createdAt: new Date('2026-09-27T00:00:00Z'),
  user: {
    id: 'u1',
    name: 'Ada',
    email: 'ada@example.com',
    image: null,
    firstName: 'Ada',
    lastName: 'Lovelace',
    isActive: true,
    emailVerified: true,
  },
};

/** A member repository that answers `findMembership` and nothing else. */
function membersAnswering(found: Option<Membership>) {
  return {
    findMembership: vi.fn().mockResolvedValue(found),
    findMembershipById: vi.fn(),
    findMembers: vi.fn(),
    findAccounts: vi.fn(),
  };
}

describe('GetMembershipQueryHandler', () => {
  it("reads the caller's membership in the organization the query names", async () => {
    const members = membersAnswering(Some(membership));
    const handler = new GetMembershipQueryHandler(members);

    const result = await handler.execute(
      new GetMembershipQuery({ organizationId: 'org-b', userId: 'u1' }),
    );

    expect(members.findMembership).toHaveBeenCalledWith('org-b', 'u1');
    expect(result).toBe(membership);
  });

  it('answers ORG_003 when the caller holds no membership there', async () => {
    const handler = new GetMembershipQueryHandler(membersAnswering(None));

    await expect(
      handler.execute(new GetMembershipQuery({ organizationId: 'org-b', userId: 'u1' })),
    ).rejects.toMatchObject({ code: 'ORG_003' });
  });
});
