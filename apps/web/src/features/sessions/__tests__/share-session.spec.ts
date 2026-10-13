import { describe, expect, it } from 'vitest';
import { SHARE_DEFAULTS, shareInput, shareSessionFormSchema } from '../lib/share-session';

/**
 * What the Share dialog sends: a link only ever watches, whatever the form
 * last held for the permission, and write access is given only once the
 * sharer says they understand it.
 */

const schema = shareSessionFormSchema({ people: 'people', ack: 'ack' });

describe('the Share dialog’s submission', () => {
  it('sends a link as watching, without people', () => {
    expect(
      shareInput({ ...SHARE_DEFAULTS, audience: 'link', access: 'write', lifetime: '7d' }),
    ).toEqual({ audience: 'link', access: 'read', lifetime: '7d' });
  });

  it('asks for someone to share with', () => {
    const parsed = schema.safeParse(SHARE_DEFAULTS);
    expect(parsed.error?.issues.map((issue) => issue.path[0])).toEqual(['people']);
  });

  it('gives write access only once it is understood', () => {
    const writing = {
      ...SHARE_DEFAULTS,
      people: ['ada@example.com'],
      access: 'write' as const,
      lifetime: '1h' as const,
    };
    expect(schema.safeParse(writing).success).toBe(false);
    expect(schema.safeParse({ ...writing, ack: true }).success).toBe(true);
  });
});
