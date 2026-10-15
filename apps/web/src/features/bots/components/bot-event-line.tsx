import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { Check, CircleAlert, X } from '@oppenheimer/design-system-web/icons';
import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * What Oppenheimer told the bot for you, as a trace line in the chat (the AI
 * Elements export's decided Confirmation): "You approved: Start Claude Code
 * on build-02…" with a check, a denial in red with a cross, an approved call
 * that failed in red. Read from the event's own fields, never its words,
 * which are the bot's. Never a bubble from you: you did not write it.
 */
export function BotEventLine({ message }: { message: BotMessageEntity }) {
  const { t } = useTranslation();
  const { event } = message;
  if (!event) {
    return <TranscriptDivider>{message.content.split('\n')[0]}</TranscriptDivider>;
  }
  const icon =
    event.outcome === 'approved' ? <Check /> : event.outcome === 'failed' ? <CircleAlert /> : <X />;
  return (
    <TranscriptDivider icon={icon} tone={event.outcome === 'approved' ? 'default' : 'danger'}>
      <span className="max-w-xl truncate" title={event.summary}>
        {t(`bots.chat.event.${event.outcome}`, { summary: event.summary })}
      </span>
    </TranscriptDivider>
  );
}
