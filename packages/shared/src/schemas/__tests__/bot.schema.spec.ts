import { describe, expect, it } from 'vitest';
import {
  BOT_PROVIDER_CATALOG,
  BOT_PROVIDER_PREFERENCE,
  BOT_PROVIDERS,
  botAdvisorFor,
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

describe('bot advisors', () => {
  // Anthropic refuses a pair outside its table with a 400, so an advisor the
  // catalog offered that the API refuses would fail every turn of that bot.
  it('offers only pairs Anthropic takes', () => {
    expect(botAdvisorFor('anthropic', 'claude-sonnet-5-5', 'claude-opus-5-5')).toBe(
      'claude-opus-5-5',
    );
    expect(botAdvisorFor('anthropic', 'claude-sonnet-5-5', 'claude-opus-4-8')).toBeNull();
    expect(botAdvisorFor('anthropic', 'claude-fable-5-2', 'claude-opus-5-5')).toBeNull();
    expect(botAdvisorFor('anthropic', 'claude-fable-5-1', 'claude-fable-5-2')).toBe(
      'claude-fable-5-2',
    );
  });

  // Claude Code reports a model advising itself under that one model, so its
  // advisor's spend would vanish into the turn's: Fable 5.2, whose only
  // advisor is itself, takes none.
  it('never pairs a model with itself', () => {
    for (const model of BOT_PROVIDER_CATALOG.anthropic.models) {
      expect(model.advisors ?? []).not.toContain(model.id);
    }
    expect(botAdvisorFor('anthropic', 'claude-fable-5-2', 'claude-fable-5-2')).toBeNull();
  });

  it('reads the default model when a bot names none', () => {
    expect(botAdvisorFor('anthropic', null, 'claude-fable-5-2')).toBe('claude-fable-5-2');
  });

  // The advisor is Anthropic's own tool: z.ai and OpenAI cannot run it.
  it('offers no advisor on any other provider', () => {
    for (const provider of BOT_PROVIDERS.filter((p) => p !== 'anthropic')) {
      for (const model of BOT_PROVIDER_CATALOG[provider].models) {
        expect(model.advisors).toBeUndefined();
      }
    }
    expect(botAdvisorFor('glm', 'glm-5.3', 'claude-opus-5-5')).toBeNull();
  });

  it('names only advisors the catalog lists', () => {
    const ids = new Set(BOT_PROVIDER_CATALOG.anthropic.models.map((model) => model.id));
    for (const model of BOT_PROVIDER_CATALOG.anthropic.models) {
      for (const advisor of model.advisors ?? []) expect(ids).toContain(advisor);
    }
  });
});
