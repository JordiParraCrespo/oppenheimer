import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteTask } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, ErrorAlert, notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Delete the cards picked on the board, one delete each, side by side; each
 * leaves the board as a single delete's does. When some fail, the dialog stays
 * with them: `onLeft` hands the board the ones still picked, the first failure
 * says why, and Delete tries them again. Their sessions are untouched.
 */
export function DeleteTasksDialog({
  tasks,
  onLeft,
  onClose,
}: {
  tasks: TaskEntity[];
  /** The tasks a delete failed on, to keep picked; empty once all are gone. */
  onLeft: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(tasks);
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const remove = useDeleteTask();

  async function confirm() {
    setPending(true);
    const results = await Promise.allSettled(left.map((task) => remove.mutateAsync(task.id)));
    setPending(false);
    const failed = left.filter((_, index) => results[index]?.status === 'rejected');
    const deleted = left.length - failed.length;
    if (deleted === 1) notifySuccess('taskDeleted');
    else if (deleted > 1) notifySuccess('tasksDeleted', { n: String(deleted) });
    onLeft(failed.map((task) => task.id));
    if (failed.length === 0) {
      onClose();
      return;
    }
    const first = results.find((result) => result.status === 'rejected');
    setFailure(first?.status === 'rejected' ? first.reason : null);
    setLeft(failed);
  }

  return (
    <ConfirmDialog
      title={t('tasks.deleteTasks.title', { count: left.length })}
      description={t('tasks.dialog.deleteDescription')}
      confirmLabel={t('tasks.deleteTasks.confirm')}
      pendingLabel={t('tasks.dialog.deleting')}
      pending={pending}
      onClose={onClose}
      onConfirm={() => void confirm()}
    >
      {failure ? (
        <ErrorAlert
          title={t('tasks.deleteTasks.partial', { count: left.length })}
          error={failure}
          fallback={t('tasks.dialog.deleteFailed')}
        />
      ) : null}
    </ConfirmDialog>
  );
}
