import { useClearBotGoal, useClearBotLoop } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import {
  type BuiltInLocalAction,
  builtInCommandActionOf,
} from '@/features/bots/lib/built-in-command';
import { openUsageCard } from '@/features/bots/lib/usage-cards';

const NOTICES = {
  goalNeedsCondition: 'bots.chat.goal.needsCondition',
  loopBadInterval: 'bots.chat.loop.badInterval',
} as const;

/**
 * The composer's side of the built-in commands (`builtInCommandActionOf`):
 * the notice a draft that cannot be sent shows, and `runLocally`, which runs
 * a built-in the console owns instead of sending it and answers whether it
 * did: `/goal clear` stops the goal, `/loop stop` the loop, `/usage` puts the
 * usage card in the chat (`openUsageCard`). A local action that fails stays
 * on screen through `error`, with the words to say it in `failure`.
 */
export function useBuiltInCommand(botId: string, draft: string) {
  const { t } = useTranslation();
  const clearGoal = useClearBotGoal();
  const clearLoop = useClearBotLoop();
  const action = builtInCommandActionOf(draft);
  const notice = action?.kind === 'notice' ? t(NOTICES[action.notice]) : undefined;

  // What each built-in the console runs does; the next one is an entry here, not a branch.
  const local: Record<BuiltInLocalAction, (onDone: () => void) => void> = {
    clearGoal: (onDone) => clearGoal.mutate({ id: botId }, { onSuccess: onDone }),
    clearLoop: (onDone) => clearLoop.mutate({ id: botId }, { onSuccess: onDone }),
    openUsage: (onDone) => {
      openUsageCard(botId);
      onDone();
    },
  };

  function runLocally(onDone: () => void): boolean {
    if (action?.kind !== 'local') return false;
    local[action.action](onDone);
    return true;
  }

  return {
    notice,
    runLocally,
    error: clearGoal.error ?? clearLoop.error,
    failure: t(clearLoop.error ? 'bots.chat.loop.stopFailed' : 'bots.chat.goal.stopFailed'),
    reset: () => {
      clearGoal.reset();
      clearLoop.reset();
    },
  };
}
