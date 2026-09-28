import { describe, expect, it, vi } from 'vitest';
import { MemberRepository } from '../member.repository';

/** A query builder that records what it was asked and answers `row`. */
function builderAnswering(row: unknown) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.getRawOne = vi.fn().mockResolvedValue(row);
  return { builder, calls };
}

const row = {
  id: 'm1',
  organizationId: 'org-b',
  userId: 'u1',
  role: 'owner',
  createdAt: new Date('2026-09-27T00:00:00Z'),
  userName: 'Ada Lovelace',
  userEmail: 'ada@example.com',
  userImage: null,
  userFirstName: 'Ada',
  userLastName: 'Lovelace',
  userIsActive: true,
  userEmailVerified: true,
};

describe('MemberRepository.findMembership', () => {
  it('reads the member row in exactly that organization joined to its account, in one query', async () => {
    const { builder, calls } = builderAnswering(row);
    const members = { createQueryBuilder: vi.fn().mockReturnValue(builder) };
    const repository = new MemberRepository(members as never, {} as never, {} as never);

    const found = await repository.findMembership('org-b', 'u1');

    expect(members.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(calls).toContainEqual({
      method: 'where',
      args: ['member.organizationId = :organizationId', { organizationId: 'org-b' }],
    });
    expect(calls).toContainEqual({
      method: 'andWhere',
      args: ['member.userId = :userId', { userId: 'u1' }],
    });
    expect(found.unwrap()).toEqual({
      id: 'm1',
      organizationId: 'org-b',
      userId: 'u1',
      role: 'owner',
      createdAt: row.createdAt,
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
    const { builder } = builderAnswering(undefined);
    const repository = new MemberRepository(
      {
        createQueryBuilder: vi.fn().mockReturnValue(builder),
      } as never,
      {} as never,
      {} as never,
    );

    expect((await repository.findMembership('org-b', 'u1')).isNone()).toBe(true);
  });
});

describe('MemberRepository.findAssignedRoles', () => {
  it('groups the role assignments by user', async () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere']) {
      builder[method] = () => builder;
    }
    builder.getRawMany = vi.fn().mockResolvedValue([
      { userId: 'u1', id: 'r-admin', name: 'admin' },
      { userId: 'u1', id: 'r-user', name: 'user' },
      { userId: 'u2', id: 'r-user', name: 'user' },
    ]);
    const repository = new MemberRepository(
      {} as never,
      {} as never,
      {
        createQueryBuilder: vi.fn().mockReturnValue(builder),
      } as never,
    );

    const byUser = await repository.findAssignedRoles(['u1', 'u2'], 'org1');

    expect(byUser.get('u1')).toEqual([
      { id: 'r-admin', name: 'admin' },
      { id: 'r-user', name: 'user' },
    ]);
    expect(byUser.get('u2')).toEqual([{ id: 'r-user', name: 'user' }]);
  });

  it('asks nothing for no users', async () => {
    const userRoles = { createQueryBuilder: vi.fn() };
    const repository = new MemberRepository({} as never, {} as never, userRoles as never);

    expect((await repository.findAssignedRoles([], 'org1')).size).toBe(0);
    expect(userRoles.createQueryBuilder).not.toHaveBeenCalled();
  });
});
