import { ChatNotice, TranscriptDivider } from '@oppenheimer/design-system-web';
import {
  CircleAlert,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
} from '@oppenheimer/design-system-web/icons';
import type { BotRoutineEvent } from '@oppenheimer/shared/schemas/bot';
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
 * What became of a routine (`26-bot-routines.md` §4): "Routine · Morning PR
 * digest" where its run opens a turn, "Created routine …" when it is saved,
 * and so on; a run that did not happen, or a pause the owner did not make,
 * is a notice instead, with `action` (Open routines) beside it.
 */
export function RoutineEventLine({
  event,
  action,
}: {
  event: BotRoutineEvent;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
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
