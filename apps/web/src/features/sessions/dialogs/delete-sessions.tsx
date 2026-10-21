import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionSelectionActions } from '../hooks/use-session-selection';

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
    const results = await Promise.allSettled(
      left.map((session) =>
        close.mutateAsync({
          id: session.id,
          acceptUnpushedWork: session.isFolder ? false : discard,
        }),
      ),
    );
    setPending(false);
    const failed = left.filter((_, index) => results[index]?.status === 'rejected');
    if (failed.length === 0) {
      clear();
      onClose();
      return;
    }
    const first = results.find((result) => result.status === 'rejected');
    setFailure(first?.reason ?? null);
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
      {failure || anyWorktree ? (
        <>
          <ErrorAlert
            title={t('sessions.deleteSessions.partial', { count: left.length })}
            error={failure}
            fallback={t('sessions.deleteSession.failed')}
          />
          {anyWorktree ? (
            <ConfirmDialog.Option checked={discard} onCheckedChange={setDiscard} disabled={pending}>
              {t('sessions.deleteSession.discard')}
            </ConfirmDialog.Option>
          ) : null}
        </>
      ) : null}
    </ConfirmDialog>
  );
}
