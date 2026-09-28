import { Checkbox, FieldLabel } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Delete a session, from the row's menu.
 *
 * "Delete" is the console's word for the API's close: the session stops,
 * its worktree leaves the host, the transcript is gone, and the row stays
 * resolved so its directory name and branch are never reissued — which is
 * why the list drops it rather than the API.
 *
 * The close refuses a worktree with work that is not pushed unless the
 * caller accepts losing it, and this dialog is where that is accepted: a
 * sentence and a box, not a hidden flag. Unticked, the copy says the delete
 * stops on such work, so a refusal is the expected answer rather than a
 * surprise. The dialog owns the mutation; a failure stays on screen next to
 * the button, never a toast. An accepted delete toasts that it was asked
 * for, not that it happened: the host does the work and may still refuse.
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
  const close = useCloseSession({
    onSuccess: () => {
      notifySuccess('sessionDeleteRequested', { name: session.name });
      onClose();
    },
  });

  return (
    <ConfirmDialog
      title={t('sessions.deleteSession.title', { name: session.name })}
      description={`${t('sessions.deleteSession.description')} ${t('sessions.deleteSession.keeps')}`}
      confirmLabel={t('sessions.deleteSession.confirm')}
      pendingLabel={t('sessions.deleteSession.deleting')}
      pending={close.isPending}
      error={close.error}
      errorFallback={t('sessions.deleteSession.failed')}
      onClose={onClose}
      onConfirm={() => close.mutate({ id: session.id, acceptUnpushedWork: discard })}
    >
      <FieldLabel className="items-center">
        <Checkbox
          checked={discard}
          onCheckedChange={(checked) => setDiscard(checked === true)}
          disabled={close.isPending}
        />
        {t('sessions.deleteSession.discard')}
      </FieldLabel>
    </ConfirmDialog>
  );
}
