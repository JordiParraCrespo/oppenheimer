import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
 * next to the button, never a toast — a host that is offline among them,
 * since the close never reached it and the row comes back.
 *
 * A folder session has no worktree and nothing of ours to push: its close
 * ends the terminal and leaves the folder as it is, so it says only that and
 * has no box to tick.
 */
export function DeleteSessionDialog({
  session,
  onClose,
}: {
  session: SessionEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [discard, setDiscard] = useState(false);
  const close = useCloseSession({ onSuccess: onClose });

  return (
    <ConfirmDialog
      title={t('sessions.deleteSession.title', { name: session.name })}
      description={
        session.isFolder
          ? t('sessions.deleteSession.descriptionFolder')
          : `${t('sessions.deleteSession.description')} ${t('sessions.deleteSession.keeps')}`
      }
      confirmLabel={t('sessions.deleteSession.confirm')}
      pendingLabel={t('sessions.deleteSession.deleting')}
      pending={close.isPending}
      error={close.error}
      errorFallback={t('sessions.deleteSession.failed')}
      onClose={onClose}
      onConfirm={() =>
        close.mutate({ id: session.id, acceptUnpushedWork: session.isFolder ? false : discard })
      }
    >
      {session.isFolder ? null : (
        <ConfirmDialog.Option
          checked={discard}
          onCheckedChange={setDiscard}
          disabled={close.isPending}
        >
          {t('sessions.deleteSession.discard')}
        </ConfirmDialog.Option>
      )}
    </ConfirmDialog>
  );
}
