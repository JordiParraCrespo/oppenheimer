import { useClearBotGoal } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { builtInCommandActionOf } from '@/features/bots/lib/built-in-command';

const NOTICES = {
  goalNeedsCondition: 'bots.chat.goal.needsCondition',
} as const;

/**
 * The composer's side of the built-in commands (`builtInCommandActionOf`):
 * the notice a draft that cannot be sent shows, and `runLocally`, which runs
 * a built-in the console owns instead of sending it and answers whether it
 * did: `/goal clear` stops the goal, `/usage` opens the usage card, which
 * stays open (`usageOpen`) until `closeUsage`. A local action that fails
 * stays on screen through `error`, with the words to say it in `failure`.
 */
export function useBuiltInCommand(botId: string, draft: string) {
  const { t } = useTranslation();
  const clearGoal = useClearBotGoal();
  const [usageOpen, setUsageOpen] = useState(false);
  const action = builtInCommandActionOf(draft);
  const notice = action?.kind === 'notice' ? t(NOTICES[action.notice]) : undefined;

  function runLocally(onDone: () => void): boolean {
    if (action?.kind !== 'local') return false;
    if (action.action === 'openUsage') {
      setUsageOpen(true);
      onDone();
    } else {
      clearGoal.mutate({ id: botId }, { onSuccess: onDone });
    }
    return true;
  }

  return {
    notice,
    runLocally,
    error: clearGoal.error,
    failure: t('bots.chat.goal.stopFailed'),
    reset: clearGoal.reset,
    usageOpen,
    closeUsage: () => setUsageOpen(false),
  };
}
