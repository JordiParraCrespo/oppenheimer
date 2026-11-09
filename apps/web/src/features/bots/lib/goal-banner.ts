import { dateFormatter, formatTokens } from '@oppenheimer/frontend-web';
import type { BotGoal } from '@oppenheimer/shared/schemas/bot';
import type { TFunction } from 'i18next';

/** What the goal banner says beside the goal, and which state it draws. */
export interface GoalBannerLine {
  /** `waiting`: a rate limit holds its next turn (a clock); `paused`: the owner resumes it. */
  state: 'running' | 'waiting' | 'paused';
  text: string;
}

/**
 * The goal banner's line beside the goal (`25-bots.md` §4.1): how many
 * continuations it has taken (of its limit, for a goal set with one) and
 * what its budget has spent; while a rate limit holds its next turn, which
 * system it waits for and until when; once it paused, why. In the reader's
 * locale. A new state of the goal is one more case here, not a branch in
 * the banner.
 */
export function goalBannerLine(goal: BotGoal, t: TFunction, locale: string): GoalBannerLine {
  if (goal.paused) {
    return { state: 'paused', text: t(`bots.chat.goal.paused.${goal.paused.reason}`) };
  }
  if (goal.waiting) {
    return {
      state: 'waiting',
      text: t('bots.chat.goal.waiting', {
        system: goal.waiting.system,
        time: dateFormatter(locale, { timeStyle: 'short' }).format(new Date(goal.waiting.until)),
      }),
    };
  }
  const progress =
    goal.limit === null
      ? t('bots.chat.goal.continuations', { count: goal.continuations })
      : t('bots.chat.goal.progress', { step: goal.continuations, limit: goal.limit });
  if (goal.tokenBudget === null) return { state: 'running', text: progress };
  return {
    state: 'running',
    text: t('bots.chat.goal.budget', {
      progress,
      used: formatTokens(goal.tokensUsed, locale),
      budget: formatTokens(goal.tokenBudget, locale),
    }),
  };
}
