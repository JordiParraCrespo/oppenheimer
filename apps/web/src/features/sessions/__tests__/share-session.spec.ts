import type { SessionShare } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { shareDefaults, shareInput, shareSessionFormSchema } from '../lib/share-session';

/**
 * What the Share dialog sends. Adding people to a share must not set its
 * expiry again from now, so while nothing but the people changed the form
 * hands back only the people; anything else is a whole `PUT`.
 */

const MESSAGES = { people: 'people', ack: 'ack', lifetime: 'lifetime' };

const SHARE: SessionShare = {
  id: 'share-1',
  slug: 'A'.repeat(22),
  audience: 'people',
  access: 'read',
  people: ['ada@example.com'],
  expiresAt: new Date('2026-10-13T13:00:00Z'),
  sharedBy: null,
  updatedAt: new Date('2026-10-13T12:00:00Z'),
};

describe('the Share dialog’s submission', () => {
  it('adds people to a share without touching its expiry', () => {
    const values = { ...shareDefaults(SHARE), people: ['ada@example.com', 'bob@example.com'] };
    expect(shareSessionFormSchema(MESSAGES, SHARE).safeParse(values).success).toBe(true);
    expect(shareInput(values)).toEqual({
      kind: 'people',
      people: ['ada@example.com', 'bob@example.com'],
    });
  });

  it('asks how long once the permission or the audience changes under a kept expiry', () => {
    const changed = { ...shareDefaults(SHARE), audience: 'link' as const };
    const parsed = shareSessionFormSchema(MESSAGES, SHARE).safeParse(changed);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path[0])).toContain('lifetime');
  });

  it('sends the whole share once a length is picked, a link always only watching', () => {
    const values = { ...shareDefaults(null), audience: 'link' as const, access: 'write' as const };
    expect(shareInput({ ...values, lifetime: '7d' })).toEqual({
      kind: 'put',
      input: { audience: 'link', access: 'read', lifetime: '7d' },
    });
  });

  it('gives write access only once it is understood', () => {
    const values = {
      ...shareDefaults(null),
      people: ['ada@example.com'],
      access: 'write' as const,
      lifetime: '1h' as const,
    };
    const schema = shareSessionFormSchema(MESSAGES, null);
    expect(schema.safeParse(values).success).toBe(false);
    expect(schema.safeParse({ ...values, ack: true }).success).toBe(true);
  });
});
