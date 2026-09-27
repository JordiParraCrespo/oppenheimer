import { describe, expect, it, vi } from 'vitest';
import { MemberRepository } from '../member.repository';

const memberRow = {
  id: 'm1',
  organizationId: 'org-b',
  userId: 'u1',
  role: 'owner',
  createdAt: new Date('2026-09-27T00:00:00Z'),
};
const userRow = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
  firstName: 'Ada',
  lastName: 'Lovelace',
  isActive: true,
  emailVerified: true,
  // Columns the read model must not carry along.
  role: 'user',
  banned: false,
};

describe('MemberRepository.findMembership', () => {
  it('reads the member row in exactly that organization, with the account behind it', async () => {
    const members = { findOne: vi.fn().mockResolvedValue(memberRow) };
    const users = { findOne: vi.fn().mockResolvedValue(userRow) };
    const repository = new MemberRepository(members as never, users as never);

    const found = await repository.findMembership('org-b', 'u1');

    expect(members.findOne).toHaveBeenCalledWith({
      where: { organizationId: 'org-b', userId: 'u1' },
    });
    expect(found.unwrap()).toEqual({
      ...memberRow,
      user: {
        id: 'u1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        image: null,
        firstName: 'Ada',
        lastName: 'Lovelace',
        isActive: true,
        emailVerified: true,
      },
    });
  });

  it('answers None for someone who is not a member there', async () => {
    const users = { findOne: vi.fn() };
    const repository = new MemberRepository(
      { findOne: vi.fn().mockResolvedValue(null) } as never,
      users as never,
    );

    expect((await repository.findMembership('org-b', 'u1')).isNone()).toBe(true);
    expect(users.findOne).not.toHaveBeenCalled();
  });
});
