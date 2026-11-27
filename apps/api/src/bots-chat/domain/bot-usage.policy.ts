import {
  BOT_MODEL_CALL_PURPOSES,
  type BotModelCallPurpose,
  type BotProvider,
  type BotTokenCounts,
  type BotUsage,
  type BotUsageBackground,
  type BotUsageModel,
} from '@oppenheimer/shared';

/**
 * What a bot spends (`/usage`): its turns by model, and
 * the calls it makes on its owner's key outside them. A call's spend is what
 * the provider reported; a provider that said nothing is a call that spent
 * nothing as far as anyone can tell, and is not recorded.
 */

/** One call outside a turn, as it is recorded. */
export interface BotModelCall extends BotTokenCounts {
  organizationId: string;
  botId: string;
  purpose: BotModelCallPurpose;
  provider: BotProvider;
  model: string;
}

/** What the read of a bot's turns and calls answers, before it is put together. */
export interface BotUsageRows {
  turns: (BotUsageModel & { activeMs: number; firstAt: Date })[];
  /** Every purpose but `advisor`. */
  background: BotUsageBackground[];
  /** The advisor's calls, by the model that answered them. */
  advisor?: (BotTokenCounts & { provider: BotProvider; model: string })[];
}

/**
 * The models a chat's tokens were spent on: its turns', and its advisor's,
 * which is another model priced as itself, so it is a share of its own (on
 * the turns' row when a turn ran on that model too) rather than a call
 * outside the turns counted as the turns' model.
 */
function modelsOf(rows: BotUsageRows): BotUsageModel[] {
  const models = rows.turns.map(({ activeMs: _active, firstAt: _first, ...model }) => ({
    ...model,
  }));
  for (const advised of rows.advisor ?? []) {
    const { provider, model, ...counts } = advised;
    const row = models.find((each) => each.provider === provider && each.model === model);
    if (!row) {
      models.push({ provider, model, turns: 0, ...counts });
      continue;
    }
    row.inputTokens += counts.inputTokens;
    row.outputTokens += counts.outputTokens;
    row.cacheReadTokens += counts.cacheReadTokens;
    row.cacheWriteTokens += counts.cacheWriteTokens;
  }
  return models;
}

/** A count as Postgres may hand it back (a `bigint` sum is a string), never below zero. */
export function tokenCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

/**
 * A bot's usage from its rows: the models by what they spent, most first,
 * the purposes in their catalog order, and the chat's first turn as `since`.
 */
export function botUsageOf(rows: BotUsageRows): BotUsage {
  const firstAt = rows.turns.reduce<Date | null>(
    (first, row) => (first === null || row.firstAt < first ? row.firstAt : first),
    null,
  );
  const spent = (row: BotTokenCounts) => row.inputTokens + row.outputTokens;
  return {
    since: firstAt ? firstAt.toISOString() : null,
    turns: rows.turns.reduce((sum, row) => sum + row.turns, 0),
    activeMs: rows.turns.reduce((sum, row) => sum + row.activeMs, 0),
    models: modelsOf(rows).sort((a, b) => spent(b) - spent(a)),
    background: [...rows.background].sort(
      (a, b) =>
        BOT_MODEL_CALL_PURPOSES.indexOf(a.purpose) - BOT_MODEL_CALL_PURPOSES.indexOf(b.purpose),
    ),
  };
}
