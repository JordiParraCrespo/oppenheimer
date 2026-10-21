import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionSelectionActions } from '../hooks/use-session-selection';
import { settleEach } from '../lib/session-selection';

/**
 * Delete the sessions picked in the sidebar: `DeleteSessionDialog` for several
 * at once, one close each, side by side. Each row leaves the sidebar on the
 * click as a single delete's does (`useCloseSession`), so the sidebar is the
 * confirmation and nothing toasts.
 *
 * The unpushed-work box covers every worktree session picked; a folder session
 * has nothing of ours to push and ignores it. When some closes fail, the
 * dialog stays with them: only those stay picked, the first failure says why,
 * and Delete tries them again.
 */
export function DeleteSessionsDialog({
  sessions,
  onClose,
}: {
  sessions: SessionEntity[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [discard, setDiscard] = useState(false);
  const [left, setLeft] = useState(sessions);
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const { keep, clear } = useSessionSelectionActions();
  const close = useCloseSession();
  const anyWorktree = left.some((session) => !session.isFolder);

  async function confirm() {
    setPending(true);
    const { failed, reason } = await settleEach(left, (session) =>
      close.mutateAsync({
        id: session.id,
        acceptUnpushedWork: session.isFolder ? false : discard,
      }),
    );
    setPending(false);
    if (failed.length === 0) {
      clear();
      onClose();
      return;
    }
    setFailure(reason);
    setLeft(failed);
    keep(failed.map((session) => session.id));
  }

  return (
    <ConfirmDialog
      title={t('sessions.deleteSessions.title', { count: left.length })}
      description={t('sessions.deleteSessions.description')}
      confirmLabel={t('sessions.deleteSessions.confirm')}
      pendingLabel={t('sessions.deleteSession.deleting')}
      pending={pending}
      onClose={onClose}
      onConfirm={() => void confirm()}
    >
      {failure ? (
        <ErrorAlert
          title={t('sessions.deleteSessions.partial', { count: left.length })}
          error={failure}
          fallback={t('sessions.deleteSession.failed')}
        />
      ) : null}
      {anyWorktree ? (
        <ConfirmDialog.Option checked={discard} onCheckedChange={setDiscard} disabled={pending}>
          {t('sessions.deleteSession.discard')}
        </ConfirmDialog.Option>
      ) : null}
    </ConfirmDialog>
  );
}
