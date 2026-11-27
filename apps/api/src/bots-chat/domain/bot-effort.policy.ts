import { type BotProvider, botModelOf, botTurnEffort } from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';

/**
 * A bot's effort as a bot reads it in `get_self`, `get_bot` and an update's
 * answer: the level its owner chose, or on Auto the level its turns run at
 * (`botTurnEffort`), so a bot asked what effort it is on answers what it runs
 * at, not the model's own default it no longer gets.
 */
export function describeBotEffort(bot: {
  provider: BotProvider;
  model: string | null;
  effort: SessionEffort | null;
}): string {
  if (bot.effort) return bot.effort;
  const runs = botTurnEffort(bot.provider, bot.model, null);
  if (runs) return `auto, runs at ${runs}`;
  const fallback = botModelOf(bot.provider, bot.model)?.effort?.default;
  return fallback ? `auto, the model's ${fallback}` : 'default';
}
