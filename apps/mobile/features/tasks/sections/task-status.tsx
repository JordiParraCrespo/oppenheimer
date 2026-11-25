import { Select } from '@oppenheimer/design-system-mobile/select';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useMoveTask } from '@oppenheimer/frontend-consumer/react';
import { TASK_STATUSES, type TaskStatus } from '@oppenheimer/shared/schemas/task';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

/** A task's column, in the system's picker: a pick moves it to the top of that column, as a drop on the board would. */
export function TaskStatusPicker({ task }: { task: TaskEntity }) {
  const { t } = useTranslation();
  const move = useMoveTask({ onError: () => Alert.alert(t('tasks.board.moveFailed')) });

  return (
    <Select<TaskStatus>
      value={move.isPending ? move.variables.status : task.status}
      options={TASK_STATUSES.map((status) => ({
        label: t(`tasks.columns.${status}`),
        value: status,
      }))}
      onValueChange={(status) => {
        if (status !== task.status) move.mutate({ id: task.id, status, afterTaskId: null });
      }}
    />
  );
}
