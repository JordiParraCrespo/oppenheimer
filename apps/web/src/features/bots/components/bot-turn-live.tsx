import { TraceLive } from '@oppenheimer/design-system-web';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';
import { liveWords, toolAction } from '@/features/bots/lib/tool-activity';

/**
 * The turn in flight, after what it has done so far (the Bots frame's live
 * line): Waiting while it queues, that it waits on its provider while the
 * engine retries a refused call ("Anthropic is limiting requests, retrying…"),
 * Thinking before its first word or call, what the running call is doing
 * ("Searching the web for …"), Writing while its words stream; its clock
 * beside it once it has started.
 */
export function BotTurnLive({
  queued,
  step,
  writing,
  waitingOn,
  provider,
  since,
}: {
  queued: boolean;
  /** The call running now, if one is. */
  step: BotToolStep | undefined;
  /** Whether text is streaming in. */
  writing: boolean;
  /** Why the engine waits to try a refused call again; none while it does not. */
  waitingOn?: 'rate_limit' | 'unavailable';
  /** The provider's name, for the wait. */
  provider: string;
  since: Date | null;
}) {
  const { t } = useTranslation();
  const words = step ? liveWords(toolAction(step)) : null;
  const label = queued
    ? t('bots.chat.turn.queued')
    : waitingOn
      ? t(`bots.chat.turn.retrying.${waitingOn}`, { provider })
      : words
        ? t(words.key, words.values)
        : writing
          ? t('bots.chat.turn.writing')
          : t('bots.chat.turn.thinking');
  return (
    <TraceLive elapsed={since && !queued ? <BotTurnClock since={since} /> : undefined}>
      {label}
    </TraceLive>
  );
}
