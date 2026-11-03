import { dateFormatter } from '@oppenheimer/frontend-web';
import type { BotGoal } from '@oppenheimer/shared/schemas/bot';
import type { TFunction } from 'i18next';

/** What the goal banner says beside the goal, and whether it says the goal waits. */
export interface GoalBannerLine {
  /** The goal waits out a system's rate limit: the banner shows a clock. */
  waiting: boolean;
  text: string;
}

/**
 * The goal banner's line beside the goal (`25-bots.md` §4.1): how many
 * continuations it has taken of its limit, or, while a rate limit holds its
 * next turn, which system it waits for and until when, in the reader's
 * locale. A new state of the goal is one more case here, not a branch in
 * the banner.
 */
export function goalBannerLine(goal: BotGoal, t: TFunction, locale: string): GoalBannerLine {
  if (goal.waiting) {
    return {
      waiting: true,
      text: t('bots.chat.goal.waiting', {
        system: goal.waiting.system,
        time: dateFormatter(locale, { timeStyle: 'short' }).format(new Date(goal.waiting.until)),
      }),
    };
  }
  return {
    waiting: false,
    text: t('bots.chat.goal.progress', { step: goal.continuations, limit: goal.limit }),
  };
}
