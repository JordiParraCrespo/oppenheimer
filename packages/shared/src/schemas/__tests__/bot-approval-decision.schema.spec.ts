import { describe, expect, it } from 'vitest';
import { decideBotApprovalSchema, denyBotApprovalSchema } from '../bot.schema.js';

/**
 * The body of a decision on a Needs input card (`25-bots.md` §5). What
 * breaks this: an approval accepted without naming the call it approves, so
 * a yes could run something the person was never shown; or the console's
 * Deny form starting to ask for a digest it has no use for.
 */
const DIGEST = 'a'.repeat(64);

describe('decideBotApprovalSchema', () => {
  it('takes an approval only with the call’s digest', () => {
    expect(decideBotApprovalSchema.safeParse({ decision: 'approve' }).success).toBe(false);
    expect(
      decideBotApprovalSchema.safeParse({ decision: 'approve', callDigest: 'not-a-digest' })
        .success,
    ).toBe(false);
    expect(
      decideBotApprovalSchema.safeParse({ decision: 'approve', callDigest: DIGEST }).success,
    ).toBe(true);
  });

  it('takes a denial with or without a note, and needs no digest for it', () => {
    expect(decideBotApprovalSchema.safeParse({ decision: 'deny' }).success).toBe(true);
    expect(denyBotApprovalSchema.safeParse({ note: 'Use staging' }).success).toBe(true);
    expect(Object.keys(denyBotApprovalSchema.shape)).toEqual(['note']);
  });
});
