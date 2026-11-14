import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { Check, CircleAlert, OctagonX, X } from '@oppenheimer/design-system-web/icons';
import type { BotApprovalEvent } from '@oppenheimer/shared/schemas/bot';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';
import { useToolCallsShownInChat } from '@/features/bots/hooks/use-tool-calls-shown';
import { approvalLineKey, showsApprovalLine } from '@/features/bots/lib/approval-event';

const ICONS: Record<BotApprovalEvent['outcome'], ReactNode> = {
  approved: <Check />,
  denied: <X />,
  stopped: <OctagonX />,
  failed: <CircleAlert />,
};

/**
 * A decided approval as a trace line (the AI Elements export's decided
 * Confirmation): "You approved: Start Claude Code on build-02…" with a
 * check, a denial in red with a cross, a denial that stopped the turn in red
 * with a stop sign, an approved call that failed in red; one that started a
 * session carries Open session. An approved call has two lines: the yes
 * ("You approved: …") when it starts, and "Done: …" (or "It failed: …")
 * over the turn that reports it. While the tool calls are hidden, a call
 * that went through draws nothing (`showsApprovalLine`).
 */
export function ApprovalEventLine({ event }: { event: BotApprovalEvent }) {
  const { t } = useTranslation();
  const toolCallsShown = useToolCallsShownInChat();
  if (!showsApprovalLine(event, toolCallsShown)) return null;
  const icon = ICONS[event.outcome];

  return (
    <TranscriptDivider
      icon={icon}
      tone={event.outcome === 'approved' ? 'default' : 'danger'}
      action={event.sessionId ? <OpenSessionButton sessionId={event.sessionId} /> : undefined}
    >
      <span className="max-w-xl truncate" title={event.summary}>
        {t(`bots.chat.event.${approvalLineKey(event)}`, { summary: event.summary })}
      </span>
    </TranscriptDivider>
  );
}
