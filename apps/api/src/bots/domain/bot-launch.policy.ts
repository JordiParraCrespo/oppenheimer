import { CODING_AGENTS, effortLevelFor, type SessionEffort } from '@oppenheimer/shared/agents';

/** A bot's turns run Claude Code (`product/versions/mvp/25-bots.md` §3: no other models yet). */
export const BOT_AGENT = 'claude-code' as const;

/** Whether `model` is a model id Claude Code's catalog lists. `null` is its default model. */
export function isBotModel(model: string | null): boolean {
  return model === null || CODING_AGENTS[BOT_AGENT].models.some((row) => row.id === model);
}

/**
 * The effort recorded for a bot on `model`: the level when that model offers it,
 * else none. `BotEntity.settleEffort` applies it whenever a bot's model or effort changes.
 */
export function botEffortFor(model: string | null, requested: unknown): SessionEffort | null {
  return effortLevelFor(BOT_AGENT, model, requested);
}
