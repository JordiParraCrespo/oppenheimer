import { describe, expect, it } from 'vitest';
import { BOT_PROVIDER_PREFERENCE, BOT_PROVIDERS, preferredKeyedProvider } from '../bot.schema.js';

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
