import { describe, expect, it } from 'vitest';
import { flagContextOf } from '../application/flag-context.resolver';

describe('flagContextOf', () => {
  it('takes identity from the credential and platform from what the client reported', () => {
    expect(
      flagContextOf(
        {
          user: { id: 'u1', email: 'ada@acme.com', role: 'admin' },
          session: { activeOrganizationId: 'org-1' },
        },
        { platform: 'ios', appVersion: '2.1.0' },
      ),
    ).toEqual({
      userId: 'u1',
      email: 'ada@acme.com',
      platformRole: 'admin',
      organizationId: 'org-1',
      platform: 'ios',
      appVersion: '2.1.0',
    });
  });

  it('is empty for an anonymous caller', () => {
    expect(flagContextOf({ user: null, session: null })).toEqual({
      userId: null,
      email: null,
      platformRole: null,
      organizationId: null,
      platform: null,
      appVersion: null,
    });
  });
});
