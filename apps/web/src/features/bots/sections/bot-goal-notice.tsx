import { ComposerNotice, ComposerStackAction } from '@oppenheimer/design-system-web';
import { Target } from '@oppenheimer/design-system-web/icons';
import { useClearBotGoal } from '@oppenheimer/frontend-consumer/react';
import type { BotGoal } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * The goal the bot keeps working toward (`25-bots.md` §4.1), fused onto the
 * composer's top edge: what it is, how many continuation turns it has taken
 * of its limit, and Stop. A Stop that fails says so in the notice itself,
 * where the button was pressed.
 */
export function BotGoalNotice({ botId, goal }: { botId: string; goal: BotGoal }) {
  const { t } = useTranslation();
  const clear = useClearBotGoal();
  return (
    <ComposerNotice
      icon={<Target />}
      action={
        <ComposerStackAction disabled={clear.isPending} onClick={() => clear.mutate({ id: botId })}>
          {t('bots.chat.goal.stop')}
        </ComposerStackAction>
      }
    >
      {clear.isError ? (
        <span className="text-danger">{t('bots.chat.goal.stopFailed')}</span>
      ) : (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate" title={goal.objective}>
            {t('bots.chat.goal.title', { objective: goal.objective })}
          </span>
          <span className="shrink-0 text-xs text-fg-muted">
            {t('bots.chat.goal.progress', { step: goal.continuations, limit: goal.limit })}
          </span>
        </span>
      )}
    </ComposerNotice>
  );
}
