import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useMoveTask } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable } from 'react-native';
import { TaskCheckMark } from '../components/task-check-mark';

/**
 * A task's done check, as the console's: a tick moves it to the top of Done,
 * an untick to the top of Not started. The row moves at once; a refusal puts
 * it back and says so.
 */
export function TaskCheck({ task }: { task: TaskEntity }) {
  const { t } = useTranslation();
  const move = useMoveTask({ onError: () => Alert.alert(t('tasks.board.moveFailed')) });

  return (
    <Pressable
      onPress={() =>
        move.mutate({ id: task.id, status: task.isDone ? 'todo' : 'done', afterTaskId: null })
      }
      disabled={move.isPending}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.isDone }}
      accessibilityLabel={task.title}
      hitSlop={8}
      className="pt-0.5"
    >
      <TaskCheckMark done={task.isDone} />
    </Pressable>
  );
}
