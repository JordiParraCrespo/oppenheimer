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
 * What a bot spends (`25-bots.md` §4.1, `/usage`): its turns by model, and
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
  background: BotUsageBackground[];
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
    models: rows.turns
      .map(({ activeMs: _active, firstAt: _first, ...model }) => model)
      .sort((a, b) => spent(b) - spent(a)),
    background: [...rows.background].sort(
      (a, b) =>
        BOT_MODEL_CALL_PURPOSES.indexOf(a.purpose) - BOT_MODEL_CALL_PURPOSES.indexOf(b.purpose),
    ),
  };
}
