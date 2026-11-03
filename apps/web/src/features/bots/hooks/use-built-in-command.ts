import { useClearBotGoal, useClearBotLoop } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
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

const FAILURES = {
  clearGoal: 'bots.chat.goal.stopFailed',
  clearLoop: 'bots.chat.loop.stopFailed',
} as const;

/**
 * The composer's side of the built-in commands (`builtInCommandActionOf`):
 * the notice a draft that cannot be sent shows, and `runLocally`, which runs
 * a built-in the console owns instead of sending it and answers whether it
 * did: `/goal clear` stops the goal, `/loop stop` the loop, `/usage` puts the
 * usage card in the chat (`openUsageCard`), `/schedule` alone opens the bot's
 * Routines tab. A local action that fails stays
 * on screen through `error`, with the words to say it in `failure`.
 */
export function useBuiltInCommand(botId: string, draft: string) {
  const { t } = useTranslation();
  const clearGoal = useClearBotGoal();
  const clearLoop = useClearBotLoop();
  const navigate = useNavigate();
  const action = builtInCommandActionOf(draft);
  const notice = action?.kind === 'notice' ? t(NOTICES[action.notice]) : undefined;

  // What each built-in the console runs does, and the request it can fail
  // with and the words for that; the next one is an entry here, not a branch.
  const local: Record<
    BuiltInLocalAction,
    {
      run: (onDone: () => void) => void;
      fails: {
        request: { error: Error | null; reset: () => void };
        failure: (typeof FAILURES)[keyof typeof FAILURES];
      } | null;
    }
  > = {
    clearGoal: {
      run: (onDone) => clearGoal.mutate({ id: botId }, { onSuccess: onDone }),
      fails: { request: clearGoal, failure: FAILURES.clearGoal },
    },
    clearLoop: {
      run: (onDone) => clearLoop.mutate({ id: botId }, { onSuccess: onDone }),
      fails: { request: clearLoop, failure: FAILURES.clearLoop },
    },
    openUsage: {
      run: (onDone) => {
        openUsageCard(botId);
        onDone();
      },
      fails: null,
    },
    openRoutines: {
      run: (onDone) => {
        onDone();
        void navigate({ to: '/bots/$botId/settings/routines', params: { botId } });
      },
      fails: null,
    },
  };
  const failing = Object.values(local).flatMap((entry) => (entry.fails ? [entry.fails] : []));
  const failed = failing.find((fails) => fails.request.error);

  function runLocally(onDone: () => void): boolean {
    if (action?.kind !== 'local') return false;
    local[action.action].run(onDone);
    return true;
  }

  return {
    notice,
    runLocally,
    error: failed?.request.error ?? null,
    // Read only beside `error`: empty while nothing failed.
    failure: failed ? t(failed.failure) : '',
    reset: () => {
      for (const fails of failing) fails.request.reset();
    },
  };
}
