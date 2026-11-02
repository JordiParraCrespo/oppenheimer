import { TranscriptDivider } from '@oppenheimer/design-system-web';
import {
  CircleCheck,
  CircleStop,
  Flag,
  Target,
  TriangleAlert,
} from '@oppenheimer/design-system-web/icons';
import type { BotGoalEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

const GOAL_KEYS = {
  continued: 'bots.chat.event.goal.continued',
  met: 'bots.chat.event.goal.met',
  impossible: 'bots.chat.event.goal.impossible',
  cleared: 'bots.chat.event.goal.cleared',
  exhausted: 'bots.chat.event.goal.exhausted',
  stopped: 'bots.chat.event.goal.stopped',
} as const;

const GOAL_ICONS = {
  continued: <Target />,
  met: <CircleCheck />,
  impossible: <TriangleAlert />,
  cleared: <CircleStop />,
  exhausted: <Flag />,
  stopped: <TriangleAlert />,
} as const;

/**
 * A bot's goal (`25-bots.md` §4.1): "Goal · continuation 2 of 5" where a
 * continuation opens a turn, or how the goal ended when the bot did not end
 * it: the reviewer found it met or out of reach, you stopped it, it ran out
 * of continuations, or a turn of it failed. The reviewer's reason follows,
 * muted, where it gave one (never for `stopped`, whose reason is a code).
 */
export function GoalEventLine({ event }: { event: BotGoalEvent }) {
  const { t } = useTranslation();
  const reason = event.activity === 'stopped' ? null : event.reason;
  return (
    <TranscriptDivider
      icon={GOAL_ICONS[event.activity]}
      tone={event.activity === 'stopped' ? 'danger' : 'default'}
    >
      <span className="max-w-xl truncate" title={reason ?? event.objective}>
        {t(GOAL_KEYS[event.activity], {
          objective: event.objective,
          step: event.step,
          limit: event.limit,
        })}
        {reason ? <span className="text-fg-muted"> · {reason}</span> : null}
      </span>
    </TranscriptDivider>
  );
}
