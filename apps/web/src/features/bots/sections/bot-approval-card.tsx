import { Button, Card, Kbd } from '@oppenheimer/design-system-web';
import { Shield } from '@oppenheimer/design-system-web/icons';
import {
  useBotPendingApproval,
  useDecideBotApproval,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { ChatMailMessage, ChatMailSendNote, ErrorAlert } from '@oppenheimer/frontend-web';
import type { BotApprovalDecision } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApprovalRequestDetails } from '@/features/bots/components/approval-request-details';
import { ApprovalNoteForm } from '@/features/bots/forms/approval-note-form';
import { useApprovalShortcuts } from '@/features/bots/hooks/use-approval-shortcuts';
import { approvalDecisionLooks } from '@/features/bots/lib/approval-decisions';

/**
 * The Needs input card (`25-bots.md` §5; the AI Elements export's
 * Confirmation): the one call the bot waits on, in words, above the composer,
 * with the decisions the API offers for it, in its order, each with its key:
 * Approve runs it once, as you; Always allow for … and Always allow leave the
 * yes standing for what it acts on, or for the tool, where the card offers
 * them (never for a merge). Deny opens a note for what to do instead, and the
 * bot carries on from it; Deny and stop ends the turn with no turn back.
 * The card goes the moment any tab decides it (the stream's
 * `approval_resolved`), and the bot reports back in the chat. It draws
 * nothing while there is no card, or while the card is being read: the chat
 * is whole without it.
 */
export function BotApprovalCard({ botId, name }: { botId: string; name: string }) {
  const { t } = useTranslation();
  const { data: approval, refetch } = useBotPendingApproval(botId);
  // A card someone else settled (a second tab, a new message) is read again.
  const decide = useDecideBotApproval({ onError: () => void refetch() });
  const [denying, setDenying] = useState(false);
  const voice = useVoiceDictation();
  const looks = approval
    ? approvalDecisionLooks(approval.details.decisions, approval.details.subjectLabel)
    : [];

  const answer = (decision: BotApprovalDecision, note?: string) => {
    if (!approval) return;
    decide.mutate(
      { id: botId, approvalId: approval.id, decision, note },
      { onSuccess: () => setDenying(false) },
    );
  };
  const pick = (decision: BotApprovalDecision) =>
    decision === 'deny' ? setDenying(true) : answer(decision);
  useApprovalShortcuts(looks, Boolean(approval) && !denying && !decide.isPending, pick);

  if (!approval) return null;
  const inFlight = decide.isPending ? (decide.variables?.decision ?? null) : null;

  return (
    <Card padded role="group" aria-label={t('bots.chat.approval.needsInput')}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Shield aria-hidden className="size-4 shrink-0 text-fg-muted" />
          <span className="flex-1 font-medium text-fg">
            {t('bots.chat.approval.title', { name })}
          </span>
          <span className="font-mono text-xs text-fg-subtle">{approval.tool}</span>
        </div>
        <p className="m-0 text-sm whitespace-pre-wrap break-words text-fg">{approval.summary}</p>
        {approval.mail ? (
          <ChatMailMessage mail={approval.mail}>
            <ChatMailSendNote mail={approval.mail} />
          </ChatMailMessage>
        ) : null}
        <p className="m-0 text-xs text-fg-muted">{t('bots.chat.approval.detail', { name })}</p>
        <ApprovalRequestDetails details={approval.details} />
        <ErrorAlert
          error={decide.error}
          fallback={t('bots.chat.approval.failed')}
          onDismiss={() => decide.reset()}
        />
        {denying ? (
          <ApprovalNoteForm
            name={name}
            voice={voice}
            isPending={decide.isPending}
            onSubmit={({ note }) => answer('deny', note)}
            onCancel={() => setDenying(false)}
          />
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            {looks.map((look) => (
              <Button
                key={look.decision}
                variant={look.variant}
                size="sm"
                aria-keyshortcuts={look.shortcut}
                title={
                  look.hint
                    ? `${t(`bots.chat.approval.${look.hint}`, { name })} · ${t('bots.chat.approval.shortcut', { key: look.shortcut })}`
                    : t('bots.chat.approval.shortcut', { key: look.shortcut })
                }
                disabled={inFlight !== null && inFlight !== look.decision}
                pending={inFlight === look.decision}
                pendingLabel={t(
                  look.decision === 'stop'
                    ? 'bots.chat.approval.stopping'
                    : 'bots.chat.approval.approving',
                )}
                onClick={() => pick(look.decision)}
              >
                {t(`bots.chat.approval.${look.label}`, {
                  subject: approval.details.subjectLabel,
                  tool: approval.tool,
                })}
                <Kbd aria-hidden className="pointer-coarse:hidden">
                  {look.shortcut}
                </Kbd>
              </Button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
