import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { CircleStop, Flag, Target, TriangleAlert } from '@oppenheimer/design-system-web/icons';
import type { BotGoalEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

const GOAL_KEYS = {
  continued: 'bots.chat.event.goal.continued',
  cleared: 'bots.chat.event.goal.cleared',
  exhausted: 'bots.chat.event.goal.exhausted',
  stopped: 'bots.chat.event.goal.stopped',
} as const;

const GOAL_ICONS = {
  continued: <Target />,
  cleared: <CircleStop />,
  exhausted: <Flag />,
  stopped: <TriangleAlert />,
} as const;

/**
 * A goal the bot set itself (`25-bots.md` §4.1): "Goal · continuation 2 of 5"
 * where a continuation opens a turn, or how the goal ended when the bot did
 * not end it: stopped by you, out of continuations, or a turn of it failed.
 */
export function GoalEventLine({ event }: { event: BotGoalEvent }) {
  const { t } = useTranslation();
  return (
    <TranscriptDivider
      icon={GOAL_ICONS[event.activity]}
      tone={event.activity === 'stopped' ? 'danger' : 'default'}
    >
      <span className="max-w-xl truncate" title={event.objective}>
        {t(GOAL_KEYS[event.activity], {
          objective: event.objective,
          step: event.step,
          limit: event.limit,
        })}
      </span>
    </TranscriptDivider>
  );
}
