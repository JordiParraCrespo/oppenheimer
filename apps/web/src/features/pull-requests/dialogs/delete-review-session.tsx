import type { ReviewSession } from '@oppenheimer/frontend-consumer';
import { useCloseReviewSession } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Delete a review session: the session's close, as Sessions' Delete is. The
 * worktree of the head branch and the transcript go; the pull request is not
 * touched. The row leaves For review on the click, so nothing toasts, and a
 * Chat tab that showed it goes back to the panel that starts one.
 *
 * The close refuses work that is not pushed unless the box accepts losing it,
 * and a host that refuses puts the row back. A failure stays by the button.
 */
export function DeleteReviewSessionDialog({
  session,
  onClose,
}: {
  session: ReviewSession;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [discard, setDiscard] = useState(false);
  const close = useCloseReviewSession({ onSuccess: onClose });

  return (
    <ConfirmDialog
      title={t('pullRequests.reviewSession.deleteTitle', { number: session.number })}
      description={t('pullRequests.reviewSession.deleteDescription', { branch: session.headRef })}
      confirmLabel={t('sessions.deleteSession.confirm')}
      pendingLabel={t('sessions.deleteSession.deleting')}
      pending={close.isPending}
      error={close.error}
      errorFallback={t('sessions.deleteSession.failed')}
      onClose={onClose}
      onConfirm={() => close.mutate({ sessionId: session.sessionId, acceptUnpushedWork: discard })}
    >
      <ConfirmDialog.Option
        checked={discard}
        onCheckedChange={setDiscard}
        disabled={close.isPending}
      >
        {t('sessions.deleteSession.discard')}
      </ConfirmDialog.Option>
    </ConfirmDialog>
  );
}
