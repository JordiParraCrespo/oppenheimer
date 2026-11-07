import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { CircleStop, Hourglass, Repeat, TriangleAlert } from '@oppenheimer/design-system-web/icons';
import type { BotLoopEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

const LOOP_KEYS = {
  ran: 'bots.chat.event.loop.ran',
  cleared: 'bots.chat.event.loop.cleared',
  expired: 'bots.chat.event.loop.expired',
  stopped: 'bots.chat.event.loop.stopped',
  ended: 'bots.chat.event.loop.ended',
} as const;

const LOOP_ICONS = {
  ran: <Repeat />,
  cleared: <CircleStop />,
  expired: <Hourglass />,
  stopped: <TriangleAlert />,
  ended: <CircleStop />,
} as const;

/**
 * A bot's loop (`25-bots.md` §4.1, `/loop`): "Loop · run 3 · check the
 * deploy" where a run opens a turn, or how the loop ended when the bot did
 * not end it: you stopped it, its 3 days ran out, a run of it failed or was
 * stopped, or a self-paced run did not say when to run next.
 */
export function LoopEventLine({ event }: { event: BotLoopEvent }) {
  const { t } = useTranslation();
  return (
    <TranscriptDivider
      icon={LOOP_ICONS[event.activity]}
      tone={event.activity === 'stopped' ? 'danger' : 'default'}
    >
      <span className="max-w-xl truncate" title={event.prompt}>
        {t(LOOP_KEYS[event.activity], { prompt: event.prompt, run: event.run })}
      </span>
    </TranscriptDivider>
  );
}
