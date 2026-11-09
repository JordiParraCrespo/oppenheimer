import { ComposerNotice, ComposerStackAction } from '@oppenheimer/design-system-web';
import { CirclePause, Clock, Target } from '@oppenheimer/design-system-web/icons';
import { useClearBotGoal, useResumeBotGoal } from '@oppenheimer/frontend-consumer/react';
import { useLocale } from '@oppenheimer/frontend-web';
import type { BotGoal } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { goalBannerLine } from '@/features/bots/lib/goal-banner';

const ICONS = { running: <Target />, waiting: <Clock />, paused: <CirclePause /> } as const;

/**
 * The goal the bot keeps working toward (`25-bots.md` §4.1), fused onto the
 * composer's top edge: what it is, how many continuation turns it has taken
 * and what its budget spent, and Stop. While a rate limit holds its next
 * turn, a clock and "waiting for Gmail until 10:02" stand in for the count,
 * so the goal does not look stalled. Once it paused, why, with Resume first
 * and Stop beside it. A Stop or a Resume that fails says so in the notice
 * itself, where the button was pressed.
 */
export function BotGoalNotice({ botId, goal }: { botId: string; goal: BotGoal }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clear = useClearBotGoal();
  const resume = useResumeBotGoal();
  const line = goalBannerLine(goal, t, locale);
  const pending = clear.isPending || resume.isPending;
  const stop = (
    <ComposerStackAction
      variant={line.state === 'paused' ? 'quiet' : 'outline'}
      disabled={pending}
      onClick={() => clear.mutate({ id: botId })}
    >
      {t('bots.chat.goal.stop')}
    </ComposerStackAction>
  );
  return (
    <ComposerNotice
      icon={ICONS[line.state]}
      action={
        line.state === 'paused' ? (
          <span className="flex items-center gap-1">
            <ComposerStackAction disabled={pending} onClick={() => resume.mutate({ id: botId })}>
              {t('bots.chat.goal.resume')}
            </ComposerStackAction>
            {stop}
          </span>
        ) : (
          stop
        )
      }
    >
      {clear.isError || resume.isError ? (
        <span className="text-danger">
          {t(clear.isError ? 'bots.chat.goal.stopFailed' : 'bots.chat.goal.resumeFailed')}
        </span>
      ) : (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate" title={goal.objective}>
            {t('bots.chat.goal.title', { objective: goal.objective })}
          </span>
          <span
            className="shrink-0 truncate text-xs text-fg-muted"
            title={goal.paused?.note ?? undefined}
          >
            {line.text}
          </span>
        </span>
      )}
    </ComposerNotice>
  );
}
