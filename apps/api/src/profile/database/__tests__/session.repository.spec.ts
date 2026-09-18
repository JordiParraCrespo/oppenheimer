import type { Repository } from 'typeorm';
import { FindOperator } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { Session } from '../../../auth/database/session.orm-entity';
import { SessionRepository } from '../session.repository';

/**
 * The session list answers one question — "which devices are signed in to my
 * account?" — and the rows `DelegatedSessionAdapter` mints for an API token or
 * an OAuth client are not an answer to it. Before issue #122 they were: one
 * account with two browsers and two credentials read as 23 devices, each with
 * a Sign out button that revoked nothing the credential could not immediately
 * rebuild.
 */

const HOUR = 60 * 60 * 1000;

function sessionRow(overrides: Partial<Session> & Pick<Session, 'id'>): Session {
  return {
    userId: 'user-1',
    token: `token-${overrides.id}`,
    ipAddress: null,
    userAgent: 'Mozilla/5.0',
    delegated: false,
    delegatedCredentialId: null,
    impersonatedBy: null,
    activeOrganizationId: null,
    activeTeamId: null,
    createdAt: new Date(Date.now() - HOUR),
    updatedAt: new Date(Date.now() - HOUR),
    expiresAt: new Date(Date.now() + HOUR),
    ...overrides,
  } as Session;
}

/**
 * Stands in for TypeORM by actually applying the `where` clause — including
 * `MoreThan` — so the assertions below are about the repository's query rather
 * than about a fake that was told the answer.
 */
function fakeRepository(stored: readonly Session[]) {
  const matches = (record: Session, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([field, expected]) => {
      const actual = (record as unknown as Record<string, unknown>)[field];
      if (expected instanceof FindOperator) {
        if (expected.type !== 'moreThan') throw new Error(`Unsupported operator ${expected.type}`);
        return (actual as Date) > (expected.value as Date);
      }
      return actual === expected;
    });

  return {
    async find(options: { where: Record<string, unknown> }) {
      return stored.filter((record) => matches(record, options.where));
    },
    async findOneBy(where: Record<string, unknown>) {
      return stored.find((record) => matches(record, where)) ?? null;
    },
  } as unknown as Repository<Session>;
}

describe('SessionRepository', () => {
  it('lists the caller’s live device sessions', async () => {
    const repository = new SessionRepository(
      fakeRepository([
        sessionRow({ id: 'laptop' }),
        sessionRow({ id: 'phone', userAgent: 'iPhone' }),
        sessionRow({ id: 'someone-else', userId: 'user-2' }),
        sessionRow({ id: 'expired', expiresAt: new Date(Date.now() - HOUR) }),
      ]),
    );

    expect((await repository.findActiveByUserId('user-1')).map((session) => session.id)).toEqual([
      'laptop',
      'phone',
    ]);
  });

  it('leaves delegated credential sessions out of the device list', async () => {
    // Two browsers and two API tokens re-minting all day: the screen says two.
    const repository = new SessionRepository(
      fakeRepository([
        sessionRow({ id: 'laptop' }),
        sessionRow({ id: 'phone', userAgent: 'iPhone' }),
        ...Array.from({ length: 21 }, (_, index) =>
          sessionRow({
            id: `delegated-${index}`,
            delegated: true,
            delegatedCredentialId: index % 2 === 0 ? 'cred-1' : 'cred-2',
            userAgent: 'oppenheimer-api-token/oppenheimer_abcd',
          }),
        ),
      ]),
    );

    expect((await repository.findActiveByUserId('user-1')).map((session) => session.id)).toEqual([
      'laptop',
      'phone',
    ]);
  });

  it('does not resolve a delegated session by id either', async () => {
    // The revoke command reads through this method, and "sign out" must not
    // promise a revocation the credential undoes on its next request.
    const repository = new SessionRepository(
      fakeRepository([
        sessionRow({ id: 'laptop' }),
        sessionRow({ id: 'bridge', delegated: true, delegatedCredentialId: 'cred-1' }),
      ]),
    );

    expect((await repository.findOneById('bridge')).isNone()).toBe(true);
    expect((await repository.findOneById('laptop')).unwrap().id).toBe('laptop');
  });
});
