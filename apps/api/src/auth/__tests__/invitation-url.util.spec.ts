import { describe, expect, it } from 'vitest';
import { buildInvitationUrl } from '../infrastructure/invitation-url.util';

describe('buildInvitationUrl', () => {
  it('carries every value the registration screen needs and URL-encodes it', () => {
    const result = new URL(
      buildInvitationUrl('https://seoterminator.com', {
        id: '2e0d0bf3-33dc-440e-866f-cf6bd5e90f98',
        email: 'jordi+seo@example.com',
        role: 'member',
        inviterName: 'Jordi Parra',
      }),
    );

    expect(result.origin).toBe('https://seoterminator.com');
    expect(result.pathname).toBe('/accept-invitation');
    expect(Object.fromEntries(result.searchParams)).toEqual({
      id: '2e0d0bf3-33dc-440e-866f-cf6bd5e90f98',
      email: 'jordi+seo@example.com',
      role: 'member',
      inviter: 'Jordi Parra',
    });
  });
});
