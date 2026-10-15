import { TurnHeader } from '@oppenheimer/design-system-web';
import type { BotTurnEntity } from '@oppenheimer/frontend-consumer';
import { dateFormatter, formatElapsed, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';
import { turnDurationMs } from '@/features/bots/lib/chat-turns';

/**
 * How a turn went, on the hairline that opens it: working with its clock
 * while it runs (waiting, before its turn comes), then how long it took, its
 * model and when it ended; stopped when someone pressed Stop; interrupted
 * when it failed.
 */
export function BotTurnHeader({ turn, modelLabel }: { turn: BotTurnEntity; modelLabel: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const labels = {
    working: turn.status === 'queued' ? t('bots.chat.turn.queued') : t('bots.chat.turn.working'),
    worked: t('bots.chat.turn.worked'),
    stopped: t('bots.chat.turn.stopped'),
    interrupted: t('bots.chat.turn.interrupted'),
  };
  if (turn.isActive) {
    return (
      <TurnHeader
        state="working"
        elapsed={turn.startedAt ? <BotTurnClock since={turn.startedAt} /> : undefined}
        labels={labels}
      />
    );
  }
  const duration = turnDurationMs(turn);
  const state =
    turn.status === 'completed' ? 'done' : turn.status === 'cancelled' ? 'stopped' : 'interrupted';
  return (
    <TurnHeader
      state={state}
      elapsed={duration === null ? undefined : formatElapsed(duration)}
      model={modelLabel}
      time={
        turn.endedAt
          ? dateFormatter(locale, { timeStyle: 'short' }).format(turn.endedAt)
          : undefined
      }
      labels={labels}
    />
  );
}
