// @vitest-environment node
import type { BotUsage } from '@oppenheimer/shared/schemas/bot';
import { describe, expect, it } from 'vitest';
import { botUsageTotals, modelShares, uncachedInput } from '../lib/bot-usage';

/**
 * What the `/usage` card reads off a bot's usage. What breaks this: the
 * cache counted on top of the input instead of inside it; a goal's reviews
 * left out of the chat's total; a share or a hit rate dividing by zero in
 * an empty chat.
 */
const counts = (input: number, output: number, read = 0, write = 0) => ({
  inputTokens: input,
  outputTokens: output,
  cacheReadTokens: read,
  cacheWriteTokens: write,
});

const usage: BotUsage = {
  since: '2026-11-02T09:00:00.000Z',
  turns: 4,
  activeMs: 656_000,
  models: [
    {
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      turns: 3,
      ...counts(9_000, 900, 8_000, 500),
    },
    { provider: 'glm', model: 'glm-5.3', turns: 1, ...counts(100, 0) },
  ],
  background: [{ purpose: 'goal_review', calls: 2, ...counts(900, 100, 800) }],
};

describe('botUsageTotals', () => {
  it('adds the turns and the calls outside them, and reads the hit rate inside the input', () => {
    expect(botUsageTotals(usage)).toEqual({
      ...counts(10_000, 1_000, 8_800, 500),
      tokens: 11_000,
      cacheHitPercent: 88,
    });
  });

  it('has no hit rate before any input', () => {
    const empty = { ...usage, models: [], background: [] };
    expect(botUsageTotals(empty).cacheHitPercent).toBeNull();
    expect(modelShares(empty)).toEqual([]);
  });
});

describe('uncachedInput', () => {
  it('is the input neither read from the cache nor written to it, never below zero', () => {
    expect(uncachedInput(counts(9_000, 0, 8_000, 500))).toBe(500);
    expect(uncachedInput(counts(10, 0, 20, 0))).toBe(0);
  });
});

describe('modelShares', () => {
  it('splits what the turns spent between the models', () => {
    expect(modelShares(usage)).toEqual([
      { model: 'claude-opus-5-5', percent: 99 },
      { model: 'glm-5.3', percent: 1 },
    ]);
  });
});
