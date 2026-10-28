import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** What deleting does, per place. */
const DESCRIPTION = {
  worktree: 'sessions.deleteSession.description',
  folder: 'sessions.deleteSession.descriptionFolder',
  cloud: 'sessions.deleteSession.descriptionCloud',
} as const satisfies Record<SessionEntity['place'], string>;

/**
 * Delete a session: the console's word for the API's close. The worktree and
 * transcript go, and the row stays resolved so its directory name and branch
 * are never reissued, which is why the list drops it rather than the API.
 *
 * The row leaves the sidebar on the click (`useCloseSession`), so the sidebar
 * is the confirmation and nothing toasts.
 *
 * The close refuses unpushed work unless the caller accepts losing it; this
 * dialog's box is where that is accepted, not a hidden flag. A failure stays
 * next to the button, never a toast. A host that is offline is not a failure:
 * the API keeps the close owed and sends it when the host is back, and the
 * row reads "Deleting…" until then.
 *
 * A session whose host refused the last delete opens with the refusal on top,
 * in the host's words: usually work that is not pushed, which the box accepts
 * losing. The box is never ticked for the reader.
 *
 * A folder session has no worktree and nothing of ours to push: its close
 * ends the terminal and leaves the folder as it is, so it says only that and
 * has no box to tick. A cloud session has nothing on its host at all: the
 * delete removes it from Oppenheimer at once, and it stays on claude.ai/code.
 */
export function DeleteSessionDialog({
  session,
  onClose,
}: {
  session: SessionEntity;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [discard, setDiscard] = useState(false);
  const close = useCloseSession({ onSuccess: onClose });
  // Only a worktree holds work of ours that a delete could lose.
  const hasWork = session.place === 'worktree';
  const refusal = session.closeRefusal;
  const refusalKey = refusal ? `errors.byCode.${refusal.code}` : null;
  const refusalReason = refusalKey
    ? i18n.exists(refusalKey)
      ? (i18n.t(refusalKey as never) as string)
      : t('sessions.deleteSession.refusedUnknown')
    : null;

  return (
    <ConfirmDialog
      title={t('sessions.deleteSession.title', { name: session.name })}
      description={t(DESCRIPTION[session.place])}
      confirmLabel={t('sessions.deleteSession.confirm')}
      pendingLabel={t('sessions.deleteSession.deleting')}
      pending={close.isPending}
      error={close.error}
      errorFallback={t('sessions.deleteSession.failed')}
      onClose={onClose}
      onConfirm={() =>
        close.mutate({ id: session.id, acceptUnpushedWork: hasWork ? discard : false })
      }
    >
      {refusal ? (
        <ErrorAlert
          title={t('sessions.deleteSession.refused')}
          message={[refusalReason, refusal.detail].filter(Boolean).join(' ')}
        />
      ) : null}
      {hasWork ? (
        <ConfirmDialog.Option
          checked={discard}
          onCheckedChange={setDiscard}
          disabled={close.isPending}
        >
          {t('sessions.deleteSession.discard')}
        </ConfirmDialog.Option>
      ) : null}
    </ConfirmDialog>
  );
}
