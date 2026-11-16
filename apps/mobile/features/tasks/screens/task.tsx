import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useTasks } from '@oppenheimer/frontend-consumer/react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
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
        {list.isPending ? (
          <View className="flex-1 items-center justify-center" aria-busy>
            <ActivityIndicator />
          </View>
        ) : list.isError ? (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Text variant="body" tone="destructive">
              {t('tasks.board.loadFailed')}
            </Text>
            <Button variant="outline" onPress={() => list.refetch()}>
              <Text>{t('common.retry')}</Text>
            </Button>
          </View>
        ) : (
          <View className="flex-1 justify-center px-6">
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Description>{t('tasks.mobile.notFound')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </View>
        )}
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
