import { describe, expect, it } from 'vitest';
import {
  BOT_PROVIDER_PREFERENCE,
  BOT_PROVIDERS,
  decideBotApprovalSchema,
  namedBotApprovalDecision,
  preferredKeyedProvider,
} from '../bot.schema.js';

describe('bot provider preference', () => {
  // A provider added to the catalog and not here would never be fallen back to.
  it('lists every catalog provider exactly once', () => {
    expect([...BOT_PROVIDER_PREFERENCE].sort()).toEqual([...BOT_PROVIDERS].sort());
  });

  it('picks the first keyed provider in preference order, not catalog order', () => {
    expect(preferredKeyedProvider(['glm', 'chatgpt'])).toBe('chatgpt');
    expect(preferredKeyedProvider([])).toBeUndefined();
  });
});

describe('a decision on a Needs input card', () => {
  const named = (body: unknown) => namedBotApprovalDecision(decideBotApprovalSchema.parse(body));

  // The older body said how far a yes goes in `reach`; dropping it would turn an Always allow into a yes to one call.
  it('reads the older approve with a reach as the decision it meant', () => {
    expect(named({ decision: 'approve' })).toBe('approve');
    expect(named({ decision: 'approve', reach: 'tool' })).toBe('approve_always');
    expect(named({ decision: 'approve', reach: 'subject' })).toBe('approve_for_subject');
  });

  it('keeps a named decision whatever reach rides with it', () => {
    expect(named({ decision: 'stop', reach: 'tool' })).toBe('stop');
    expect(named({ decision: 'approve_always' })).toBe('approve_always');
  });
});
