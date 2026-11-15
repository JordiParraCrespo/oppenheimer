import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteTask } from '@oppenheimer/frontend-consumer/react';
import { BulkConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Delete the cards picked on the board, one delete each, side by side; each
 * leaves the board as a single delete's does. When some fail, the dialog stays
 * with them and Delete tries them again (`BulkConfirmDialog`). Their sessions
 * are untouched.
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
  const remove = useDeleteTask();

  return (
    <BulkConfirmDialog
      items={tasks}
      keyOf={(task) => task.id}
      run={(task) => remove.mutateAsync(task.id)}
      title={(count) => t('tasks.deleteTasks.title', { count })}
      description={t('tasks.deleteTasks.description')}
      confirmLabel={() => t('tasks.deleteTasks.confirm')}
      pendingLabel={t('tasks.dialog.deleting')}
      partial={(count) => t('tasks.deleteTasks.partial', { count })}
      errorFallback={t('tasks.dialog.deleteFailed')}
      onDone={(deleted) =>
        deleted.length === 1
          ? notifySuccess('taskDeleted')
          : notifySuccess('tasksDeleted', { n: String(deleted.length) })
      }
      onLeft={onLeft}
      onClose={onClose}
    />
  );
}
