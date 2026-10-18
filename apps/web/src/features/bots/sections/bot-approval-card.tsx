import { Button, Card, useNow } from '@oppenheimer/design-system-web';
import { Shield } from '@oppenheimer/design-system-web/icons';
import {
  useBotPendingApproval,
  useDecideBotApproval,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApprovalNoteForm } from '@/features/bots/forms/approval-note-form';

/**
 * The Needs input card (`25-bots.md` §5; the AI Elements export's
 * Confirmation): the one call the bot waits on, in words, above the composer.
 * Approve runs it once, as you, and names the exact call shown, so it never
 * approves another; Deny opens a note for what to do instead. Either way the
 * card goes and the bot reports back in the chat. Once the card is past its
 * time it says so and offers neither. It draws nothing while there is no card,
 * or while the card is being read: the chat is whole without it.
 */
export function BotApprovalCard({ botId, name }: { botId: string; name: string }) {
  const { t } = useTranslation();
  const { data: approval, refetch } = useBotPendingApproval(botId);
  // A card someone else settled (a second tab, a new message) is read again.
  const decide = useDecideBotApproval({ onError: () => void refetch() });
  const [denying, setDenying] = useState(false);
  const voice = useVoiceDictation();
  const now = useNow(CORE_CONFIG.clock.everyHalfMinuteMs);

  if (!approval) return null;
  const expired = approval.isExpiredAt(now);
  const answer = (decision: 'approve' | 'deny', note?: string) =>
    decide.mutate(
      {
        id: botId,
        approvalId: approval.id,
        decision,
        note,
        ...(decision === 'approve' ? { callDigest: approval.callDigest } : {}),
      },
      { onSuccess: () => setDenying(false) },
    );

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
        <p className="m-0 text-xs text-fg-muted">
          {expired
            ? t('bots.chat.approval.expired', { name })
            : t('bots.chat.approval.detail', { name })}
        </p>
        <ErrorAlert
          error={decide.error}
          fallback={t('bots.chat.approval.failed')}
          onDismiss={() => decide.reset()}
        />
        {expired ? null : denying ? (
          <ApprovalNoteForm
            name={name}
            voice={voice}
            isPending={decide.isPending}
            onSubmit={({ note }) => answer('deny', note)}
            onCancel={() => setDenying(false)}
          />
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={decide.isPending}
              onClick={() => setDenying(true)}
            >
              {t('bots.chat.approval.deny')}
            </Button>
            <Button
              size="sm"
              pending={decide.isPending}
              pendingLabel={t('bots.chat.approval.approving')}
              onClick={() => answer('approve')}
            >
              {t('bots.chat.approval.approve')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
