import { useTasks } from '@oppenheimer/frontend-consumer/react';
import { RecordState } from '@oppenheimer/frontend-mobile';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TaskActions } from '../sections/task-actions';
import { TaskDetail } from '../sections/task-detail';

/** One task, opened from Plan: its ··· menu in the navigation bar, and its page. Read off the board's list. */
export function TaskScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const list = useTasks({ select: (rows) => rows.find((row) => row.id === id) ?? null });
  const task = list.data ?? null;

  if (!task) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <RecordState
          pending={list.isPending}
          failed={list.isError ? t('tasks.board.loadFailed') : null}
          onRetry={() => list.refetch()}
          notFound={t('tasks.mobile.notFound')}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '', headerRight: () => <TaskActions task={task} /> }} />
      <TaskDetail task={task} />
    </>
  );
}
