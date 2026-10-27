import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { Ban, CircleAlert, CircleCheck, Clock, Hand } from '@oppenheimer/design-system-web/icons';
import type { BotSessionEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';

/** The line's words by the task's state; `requires_action` reads as input needed. */
const SESSION_KEYS = {
  requires_action: 'bots.chat.event.session.needsInput',
  completed: 'bots.chat.event.session.completed',
  failed: 'bots.chat.event.session.failed',
  cancelled: 'bots.chat.event.session.cancelled',
  expired: 'bots.chat.event.session.expired',
} as const;

const SESSION_ICONS = {
  requires_action: <Hand />,
  completed: <CircleCheck />,
  failed: <CircleAlert />,
  cancelled: <Ban />,
  expired: <Clock />,
} as const;

/**
 * A session the bot follows that woke it (`27-bot-subscriptions.md`):
 * "Session “Research” finished" with Open session, in red when it failed.
 */
export function SessionEventLine({ event }: { event: BotSessionEvent }) {
  const { t } = useTranslation();
  return (
    <TranscriptDivider
      icon={SESSION_ICONS[event.state]}
      tone={event.state === 'failed' ? 'danger' : 'default'}
      action={<OpenSessionButton sessionId={event.sessionId} />}
    >
      <span className="max-w-xl truncate" title={event.sessionName}>
        {t(SESSION_KEYS[event.state], { name: event.sessionName })}
      </span>
    </TranscriptDivider>
  );
}
