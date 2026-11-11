import { ChatNotice } from '@oppenheimer/design-system-web';
import type { BotRoutineEvent } from '@oppenheimer/shared/schemas/bot';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { routineEventText, routineNeedsOwner } from '@/features/bots/lib/routine-event';

/**
 * A routine's activity the owner has to act on (`26-bot-routines.md` §4): a
 * run that did not happen, or a pause they did not make, as a notice with
 * `action` (Open routines) beside it. Nothing else of a routine has a line:
 * its run reads as the bot writing to you (`isShownEvent`).
 */
export function RoutineEventLine({
  event,
  action,
}: {
  event: BotRoutineEvent;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  if (!routineNeedsOwner(event)) return null;
  return (
    <ChatNotice tone={event.activity === 'failed' ? 'danger' : 'warning'} action={action}>
      {routineEventText(event, t)}
    </ChatNotice>
  );
}
