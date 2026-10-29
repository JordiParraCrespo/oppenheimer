import { Button, Card } from '@oppenheimer/design-system-web';
import { Shield } from '@oppenheimer/design-system-web/icons';
import {
  useBotPendingApproval,
  useDecideBotApproval,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { ChatMailMessage, ChatMailSendNote, ErrorAlert } from '@oppenheimer/frontend-web';
import type { BotApprovalReach } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApprovalRequestDetails } from '@/features/bots/components/approval-request-details';
import { ApprovalNoteForm } from '@/features/bots/forms/approval-note-form';
import { BotQuestionCard } from './bot-question-card';

/**
 * The Needs input card (`25-bots.md` §5; the AI Elements export's
 * Confirmation): the one call the bot waits on, in words, above the composer.
 * Approve runs it once, as you; Always allow for … and Always allow also
 * leave the yes standing for the thing it acts on, or for the tool, where the
 * card offers them (never for a merge). Deny opens a note for what to do
 * instead.
 * Either way the card goes and the bot reports back in the chat. A card of
 * questions (`ask_user`) is answered instead, in `BotQuestionCard`. It draws
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

  if (!approval) return null;
  if (approval.isQuestion) return <BotQuestionCard botId={botId} approval={approval} />;
  const { reaches, subjectLabel } = approval.details;
  const answer = (decision: 'approve' | 'deny', note?: string, reach?: BotApprovalReach) =>
    decide.mutate(
      { id: botId, approvalId: approval.id, decision, note, reach },
      { onSuccess: () => setDenying(false) },
    );
  const approving = (reach: BotApprovalReach) =>
    decide.isPending && decide.variables?.reach === reach;

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
            <Button
              variant="secondary"
              size="sm"
              disabled={decide.isPending}
              onClick={() => setDenying(true)}
            >
              {t('bots.chat.approval.deny')}
            </Button>
            {reaches.includes('subject') && subjectLabel ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={decide.isPending && !approving('subject')}
                pending={approving('subject')}
                pendingLabel={t('bots.chat.approval.approving')}
                onClick={() => answer('approve', undefined, 'subject')}
              >
                {t('bots.chat.approval.alwaysFor', { subject: subjectLabel })}
              </Button>
            ) : null}
            {reaches.includes('tool') ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={decide.isPending && !approving('tool')}
                pending={approving('tool')}
                pendingLabel={t('bots.chat.approval.approving')}
                onClick={() => answer('approve', undefined, 'tool')}
              >
                {t('bots.chat.approval.always', { tool: approval.tool })}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={decide.isPending && !approving('once')}
              pending={approving('once')}
              pendingLabel={t('bots.chat.approval.approving')}
              onClick={() => answer('approve', undefined, 'once')}
            >
              {t(
                reaches.length > 1
                  ? 'bots.chat.approval.approveOnce'
                  : 'bots.chat.approval.approve',
              )}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
