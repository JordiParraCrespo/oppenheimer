import { AnsweredQuestions, TranscriptDivider } from '@oppenheimer/design-system-web';
import { Check, CircleAlert, X } from '@oppenheimer/design-system-web/icons';
import type { BotApprovalEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';
import { approvalEventKey } from '@/features/bots/lib/approval-event';

/**
 * A decided approval as a trace line (the AI Elements export's decided
 * Confirmation): "You approved: Start Claude Code on build-02…" with a
 * check, a denial in red with a cross, an approved call that failed in red;
 * one that started a session carries Open session. Answered questions are a
 * check with each question over its answer; dismissed ones a plain cross.
 */
export function ApprovalEventLine({ event }: { event: BotApprovalEvent }) {
  const { t } = useTranslation();
  const key = approvalEventKey(event);
  const icon =
    key === 'approved' || key === 'answered' ? (
      <Check />
    ) : key === 'failed' ? (
      <CircleAlert />
    ) : (
      <X />
    );
  return (
    <>
      <TranscriptDivider
        icon={icon}
        tone={key === 'denied' || key === 'failed' ? 'danger' : 'default'}
        action={event.sessionId ? <OpenSessionButton sessionId={event.sessionId} /> : undefined}
      >
        <span className="max-w-xl truncate" title={event.summary}>
          {t(`bots.chat.event.${key}`, { summary: event.summary })}
        </span>
      </TranscriptDivider>
      {event.answers?.length ? <AnsweredQuestions items={event.answers} /> : null}
    </>
  );
}
