import { Checkbox, FieldLabel } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert } from '@oppenheimer/frontend-web';
import { useMatchRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Delete a session: the console's word for the API's close. The worktree and
 * transcript go, and the row stays resolved so its directory name and branch
 * are never reissued, which is why the list drops it rather than the API.
 *
 * The row leaves the sidebar on the click (`useCloseSession`), so the sidebar
 * is the confirmation and nothing toasts. A reader deleting the session they
 * have open is taken to New session rather than left on a terminal that is
 * about to end.
 *
 * The close refuses unpushed work unless the caller accepts losing it; this
 * dialog's box is where that is accepted, not a hidden flag. A failure stays
 * next to the button, never a toast, and so does a host that is offline: the
 * close never reached it, the row comes back, and the dialog says so.
 */
export function DeleteSessionDialog({
  session,
  onClose,
}: {
  session: SessionEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const [discard, setDiscard] = useState(false);
  const [hostOffline, setHostOffline] = useState(false);
  const close = useCloseSession({
    onSuccess: (closed) => {
      if (closed.isHostOffline) {
        setHostOffline(true);
        return;
      }
      if (matchRoute({ to: '/sessions/$sessionId', params: { sessionId: session.id } })) {
        void navigate({ to: '/sessions/new' });
      }
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
      onConfirm={() => {
        setHostOffline(false);
        close.mutate({ id: session.id, acceptUnpushedWork: discard });
      }}
    >
      <FieldLabel className="items-center">
        <Checkbox
          checked={discard}
          onCheckedChange={(checked) => setDiscard(checked === true)}
          disabled={close.isPending}
        />
        {t('sessions.deleteSession.discard')}
      </FieldLabel>
      <ErrorAlert message={hostOffline ? t('sessions.deleteSession.hostOffline') : null} />
    </ConfirmDialog>
  );
}
