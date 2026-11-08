import { type BotProvider, botEffortLevelFor } from '@oppenheimer/shared';

/**
 * The effort a reviewer call (a goal's verdict, a rule check) runs at: the
 * lowest the model offers, or none when it offers no levels. A verdict needs
 * little reasoning, and passing none to a model that has levels gives its
 * default, which for most is not low.
 */
export function reviewEffort(target: {
  provider: BotProvider;
  model: string | null;
}): 'low' | null {
  return botEffortLevelFor(target.provider, target.model, 'low') === 'low' ? 'low' : null;
}
