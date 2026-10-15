import { type BotProvider, botEffortLevelFor, botModelOf } from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';

/**
 * Whether `model` is one `provider` offers a bot (`BOT_PROVIDER_CATALOG`).
 * `null` is the provider's default model.
 */
export function isBotModel(provider: BotProvider, model: string | null): boolean {
  return botModelOf(provider, model) !== undefined;
}

/**
 * The effort recorded for a bot on `provider` and `model`: the level when that
 * model offers it, else none. `BotEntity.settleEffort` applies it whenever a
 * bot's provider, model or effort changes.
 */
export function botEffortFor(
  provider: BotProvider,
  model: string | null,
  requested: unknown,
): SessionEffort | null {
  return botEffortLevelFor(provider, model, requested);
}
