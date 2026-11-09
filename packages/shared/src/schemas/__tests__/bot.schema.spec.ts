import { describe, expect, it } from 'vitest';
import { effortFor } from '../../agents/catalog.js';
import {
  BOT_PROVIDER_PREFERENCE,
  BOT_PROVIDERS,
  botEffortSent,
  botModelOf,
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

describe('a bot’s effort on Fable 5.2', () => {
  // What breaks this: the bot's slider reads Medium while its turns send no
  // effort and Claude runs them at high, or a session's Fable 5.2 drops to
  // medium with the bot's.
  it('defaults to medium for a bot and sends it, where a session keeps high', () => {
    expect(botModelOf('anthropic', 'claude-fable-5-2')?.effort?.default).toBe('medium');
    expect(botEffortSent('anthropic', 'claude-fable-5-2', null)).toBe('medium');
    expect(botEffortSent('anthropic', 'claude-fable-5-2', 'max')).toBe('max');
    expect(effortFor('claude-code', 'claude-fable-5-2')?.default).toBe('high');
  });

  it('sends nothing for a model a bot runs at the provider’s own default', () => {
    expect(botEffortSent('anthropic', null, null)).toBeNull();
    expect(botEffortSent('anthropic', 'claude-sonnet-5-5', null)).toBeNull();
    expect(botEffortSent('xai', 'grok-4.7', null)).toBeNull();
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
