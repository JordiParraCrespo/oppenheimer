import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import {
  type BotProvider,
  botAdvisorFor,
  botEffortLevelFor,
  botModelOf,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';

/** What runs a bot's turns: who answers it, on which model, at which effort, with which advisor. */
export interface BotEngine {
  provider: BotProvider;
  /** A model id the provider offers; null runs the provider's default. */
  model: string | null;
  /** A level the model offers; null is Auto (`botTurnEffort`). */
  effort: SessionEffort | null;
  /** A model this one lists as an advisor (`BotModel.advisors`); null consults none. */
  advisorModel: string | null;
}

/** The engine fields an edit names; one left out is not being changed. */
export type BotEngineEdit = Partial<BotEngine>;

/** A model the bot's provider does not offer (`BOT_PROVIDER_CATALOG`). */
export class BotModelUnsupportedException extends ArgumentInvalidException {}

/**
 * The engine a bot has after `edit`, always a valid tuple:
 *
 * - the provider is the edit's, else the current one;
 * - the model is the edit's, else the current one on the same provider, else
 *   (a new provider) that provider's default. One the provider does not offer
 *   is refused;
 * - the effort is the edit's, else the current one on the same provider, else
 *   none; kept only when the model offers it, so a new model alone can unset it;
 * - the advisor likewise: kept only when the model takes it as one.
 */
export function resolveBotEngine(current: BotEngine, edit: BotEngineEdit): BotEngine {
  const provider = edit.provider ?? current.provider;
  const sameProvider = provider === current.provider;
  const model = edit.model !== undefined ? edit.model : sameProvider ? current.model : null;
  if (botModelOf(provider, model) === undefined) {
    throw new BotModelUnsupportedException(`${model} is not a ${provider} model`);
  }
  const effort = edit.effort !== undefined ? edit.effort : sameProvider ? current.effort : null;
  const advisor =
    edit.advisorModel !== undefined
      ? edit.advisorModel
      : sameProvider
        ? current.advisorModel
        : null;
  return {
    provider,
    model,
    effort: botEffortLevelFor(provider, model, effort),
    advisorModel: botAdvisorFor(provider, model, advisor),
  };
}
