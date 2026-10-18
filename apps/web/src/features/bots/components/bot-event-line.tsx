import { ChatNotice, TranscriptDivider } from '@oppenheimer/design-system-web';
import {
  Check,
  CircleAlert,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from '@oppenheimer/design-system-web/icons';
import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { routineEventText, routineNeedsOwner } from '@/features/bots/lib/routine-event';

const ROUTINE_ICONS = {
  ran: <Repeat />,
  saved: <Plus />,
  changed: <Pencil />,
  paused: <Pause />,
  resumed: <Play />,
  deleted: <Trash2 />,
  failed: <CircleAlert />,
} as const;

/**
 * What Oppenheimer told the bot for you, as a trace line in the chat (the AI
 * Elements export's decided Confirmation): "You approved: Start Claude Code
 * on build-02…" with a check, a denial in red with a cross, an approved call
 * that failed in red; or what became of a routine (`26-bot-routines.md` §4):
 * "Routine · Morning PR digest" where its run opens a turn, "Created routine
 * …" when it is saved, and so on. A run that did not happen, or a pause the
 * owner did not make, is a notice instead, with `action` (Open routines)
 * beside it. Read from the event's own fields, never its words, which are
 * the bot's. Never a bubble from you: you did not write it.
 */
export function BotEventLine({
  message,
  action,
}: {
  message: BotMessageEntity;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const { event } = message;
  if (!event) {
    return <TranscriptDivider>{message.content.split('\n')[0]}</TranscriptDivider>;
  }
  if (event.kind === 'routine') {
    const text = routineEventText(event, t);
    if (routineNeedsOwner(event)) {
      return (
        <ChatNotice tone={event.activity === 'failed' ? 'danger' : 'warning'} action={action}>
          {text}
        </ChatNotice>
      );
    }
    return (
      <TranscriptDivider icon={ROUTINE_ICONS[event.activity]}>
        <span className="max-w-xl truncate" title={event.name}>
          {text}
        </span>
      </TranscriptDivider>
    );
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
