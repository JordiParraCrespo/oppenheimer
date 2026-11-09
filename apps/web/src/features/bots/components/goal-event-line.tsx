import { TranscriptDivider } from '@oppenheimer/design-system-web';
import {
  CircleCheck,
  CirclePause,
  CirclePlay,
  CircleStop,
  Flag,
  Target,
  TriangleAlert,
} from '@oppenheimer/design-system-web/icons';
import { BOT_GOAL_PAUSE_REASONS, type BotGoalEvent } from '@oppenheimer/shared/schemas/bot';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

const GOAL_KEYS = {
  continued: 'bots.chat.event.goal.continued',
  continuedOpen: 'bots.chat.event.goal.continuedOpen',
  paused: 'bots.chat.event.goal.paused',
  resumed: 'bots.chat.event.goal.resumed',
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
  paused: <CirclePause />,
  resumed: <CirclePlay />,
} as const;

/** Why a `paused` line's goal paused, in words; empty for any other line or an unknown reason. */
function pauseWords(event: BotGoalEvent, t: TFunction): string {
  const reason = BOT_GOAL_PAUSE_REASONS.find((known) => known === event.reason);
  return event.activity === 'paused' && reason ? t(`bots.chat.goal.paused.${reason}`) : '';
}

/** The key of a line: a continuation of a goal with no limit says only its number. */
function keyOf(event: BotGoalEvent): (typeof GOAL_KEYS)[keyof typeof GOAL_KEYS] {
  if (event.activity === 'continued' && event.limit === null) return GOAL_KEYS.continuedOpen;
  return GOAL_KEYS[event.activity];
}

/**
 * A bot's goal (`25-bots.md` §4.1): "Goal · continuation 2" where a
 * continuation opens a turn ("2 of 5" for a goal set with a limit), how the
 * goal ended when the bot did not end it (the reviewer found it met or out
 * of reach, you stopped it, it ran out of continuations, its owner lost
 * access), or that it paused, and why, or you resumed it. The reviewer's
 * reason follows, muted, where it gave one (never for `stopped` or
 * `paused`, whose reason is a code: a pause's is in its words).
 */
export function GoalEventLine({ event }: { event: BotGoalEvent }) {
  const { t } = useTranslation();
  const coded = event.activity === 'stopped' || event.activity === 'paused';
  const reason = coded ? null : event.reason;
  return (
    <TranscriptDivider
      icon={GOAL_ICONS[event.activity]}
      tone={event.activity === 'stopped' ? 'danger' : 'default'}
    >
      <span className="max-w-xl truncate" title={reason ?? event.objective}>
        {t(keyOf(event), {
          objective: event.objective,
          step: event.step,
          limit: event.limit,
          why: pauseWords(event, t),
        })}
        {reason ? <span className="text-fg-muted"> · {reason}</span> : null}
      </span>
    </TranscriptDivider>
  );
}
