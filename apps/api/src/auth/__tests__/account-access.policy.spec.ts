import { describe, expect, it } from 'vitest';
import { type AccountStanding, isAccessAllowed } from '../domain/account-access.policy';

const now = new Date('2026-09-28T12:00:00.000Z');
const minute = 60 * 1000;

describe('isAccessAllowed', () => {
  const cases: [string, AccountStanding, boolean][] = [
    [
      'an active account that is not banned',
      { isActive: true, banned: false, banExpires: null },
      true,
    ],
    ['a deactivated account', { isActive: false, banned: false, banExpires: null }, false],
    [
      'a deactivated account whose ban has expired',
      { isActive: false, banned: true, banExpires: new Date(now.getTime() - minute) },
      false,
    ],
    ['a ban with no expiry', { isActive: true, banned: true, banExpires: null }, false],
    [
      'a ban that expires in a minute',
      { isActive: true, banned: true, banExpires: new Date(now.getTime() + minute) },
      false,
    ],
    [
      'a ban that expired a millisecond ago',
      { isActive: true, banned: true, banExpires: new Date(now.getTime() - 1) },
      true,
    ],
    ['a ban that expires exactly now', { isActive: true, banned: true, banExpires: now }, true],
    [
      'a ban whose past expiry arrives as an ISO string',
      { isActive: true, banned: true, banExpires: new Date(now.getTime() - minute).toISOString() },
      true,
    ],
    [
      'a ban whose expiry does not parse',
      { isActive: true, banned: true, banExpires: 'not a date' },
      false,
    ],
    [
      'an account with no ban column (null)',
      { isActive: true, banned: null, banExpires: null },
      true,
    ],
    [
      'an account with no ban column (undefined)',
      { isActive: true, banned: undefined, banExpires: undefined },
      true,
    ],
  ];

  it.each(cases)('%s', (_label, account, expected) => {
    expect(isAccessAllowed(account, now)).toBe(expected);
  });
});
