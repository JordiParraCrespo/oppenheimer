import { type BotProvider, botAdvisorFor, botModelOf } from '@oppenheimer/shared';
import { modelLabel } from './bot-model-name.policy';

/**
 * A bot's advisor as a bot reads it in `get_self` and `get_bot`: the one its
 * turns consult, by label and id, read as a turn reads it (kept only while
 * its model takes it); otherwise none, and whether its model takes one, so a
 * bot asked to set one knows before it calls `update_bot`.
 */
export function describeBotAdvisor(bot: {
  provider: BotProvider;
  model: string | null;
  advisorModel: string | null;
}): string {
  const advisor = botAdvisorFor(bot.provider, bot.model, bot.advisorModel);
  if (advisor) return `${modelLabel(bot.provider, advisor)} (${advisor})`;
  const offered = botModelOf(bot.provider, bot.model)?.advisors ?? [];
  if (offered.length === 0) return 'none (its model takes none)';
  return `none (its model takes ${offered.map((id) => modelLabel(bot.provider, id)).join(', ')})`;
}
