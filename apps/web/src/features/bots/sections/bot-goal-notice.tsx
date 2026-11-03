import { ComposerNotice, ComposerStackAction } from '@oppenheimer/design-system-web';
import { Clock, Target } from '@oppenheimer/design-system-web/icons';
import { useClearBotGoal } from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, useLocale } from '@oppenheimer/frontend-web';
import type { BotGoal } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * The goal the bot keeps working toward (`25-bots.md` §4.1), fused onto the
 * composer's top edge: what it is, how many continuation turns it has taken
 * of its limit, and Stop. While a turn of it ended on a system's rate limit
 * and its next turn is held until the limit ends, a clock and "waiting for
 * Gmail until 10:02" stand in for the count, so the goal does not look
 * stalled. A Stop that fails says so in the notice itself, where the button
 * was pressed.
 */
export function BotGoalNotice({ botId, goal }: { botId: string; goal: BotGoal }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clear = useClearBotGoal();
  const { waiting } = goal;
  return (
    <ComposerNotice
      icon={waiting ? <Clock /> : <Target />}
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
            {waiting
              ? t('bots.chat.goal.waiting', {
                  system: waiting.system,
                  time: dateFormatter(locale, { timeStyle: 'short' }).format(
                    new Date(waiting.until),
                  ),
                })
              : t('bots.chat.goal.progress', { step: goal.continuations, limit: goal.limit })}
          </span>
        </span>
      )}
    </ComposerNotice>
  );
}
