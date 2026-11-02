import type { BotTokenCounts, BotUsage } from '@oppenheimer/shared/schemas/bot';

/**
 * What the `/usage` card reads off a bot's usage (`25-bots.md` §4.1): the
 * totals of its turns and of its calls outside them, the cache's share of
 * what was sent, and each model's share of what the turns spent. Cache reads
 * and writes are part of the input; what the card calls Input is the rest.
 */
export interface BotUsageTotals extends BotTokenCounts {
  /** Every token, in and out, the turns and the calls outside them alike. */
  tokens: number;
  /** The share of the input read from the prompt cache, 0–100; null before any input. */
  cacheHitPercent: number | null;
}

const NO_TOKENS: BotTokenCounts = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

function add(a: BotTokenCounts, b: BotTokenCounts): BotTokenCounts {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/** What the chat spent, its turns and its calls outside them together. */
export function botUsageTotals(usage: BotUsage): BotUsageTotals {
  const sum = [...usage.models, ...usage.background].reduce<BotTokenCounts>(add, NO_TOKENS);
  return {
    ...sum,
    tokens: sum.inputTokens + sum.outputTokens,
    cacheHitPercent:
      sum.inputTokens > 0 ? Math.round((sum.cacheReadTokens / sum.inputTokens) * 100) : null,
  };
}

/** The input sent fresh: what was neither read from the cache nor written to it. */
export function uncachedInput(counts: BotTokenCounts): number {
  return Math.max(0, counts.inputTokens - counts.cacheReadTokens - counts.cacheWriteTokens);
}

/** Each model's share of what the turns spent, 0–100, in the usage's order. */
export function modelShares(usage: BotUsage): { model: string; percent: number }[] {
  const spent = (counts: BotTokenCounts) => counts.inputTokens + counts.outputTokens;
  const total = usage.models.reduce((sum, model) => sum + spent(model), 0);
  return usage.models.map((model) => ({
    model: model.model,
    percent: total > 0 ? Math.round((spent(model) / total) * 100) : 0,
  }));
}
