import { TraceLive } from '@oppenheimer/design-system-web';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';
import { toolAction } from '@/features/bots/lib/tool-activity';

/**
 * The turn in flight, after what it has done so far (the Bots frame's live
 * line): Waiting while it queues, Thinking before its first word or call,
 * what the running call is doing ("Searching the web for …"), Writing while
 * its words stream; its clock beside it once it has started.
 */
export function BotTurnLive({
  queued,
  step,
  writing,
  since,
}: {
  queued: boolean;
  /** The call running now, if one is. */
  step: BotToolStep | undefined;
  /** Whether text is streaming in. */
  writing: boolean;
  since: Date | null;
}) {
  const { t } = useTranslation();
  const action = step ? toolAction(step) : null;
  const label = queued
    ? t('bots.chat.turn.queued')
    : action?.kind === 'search'
      ? action.query
        ? t('bots.chat.activity.searchingFor', { query: action.query })
        : t('bots.chat.activity.searching')
      : action?.kind === 'plan'
        ? t('bots.chat.activity.planning')
        : action?.kind === 'delegate'
          ? t('bots.chat.activity.delegating', { count: action.tasks })
          : action
            ? t('bots.chat.activity.using', { name: action.label })
            : writing
              ? t('bots.chat.turn.writing')
              : t('bots.chat.turn.thinking');
  return (
    <TraceLive elapsed={since && !queued ? <BotTurnClock since={since} /> : undefined}>
      {label}
    </TraceLive>
  );
}
