import MenuView from '@expo/ui/community/menu';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Ellipsis } from '@oppenheimer/design-system-mobile/icons';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteTask } from '@oppenheimer/frontend-consumer/react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

/**
 * The task's ··· in the navigation bar, the system's own menu: Delete task,
 * which asks first in the system's alert with the console's words, and goes
 * back to the board once it is gone.
 */
export function TaskActions({ task }: { task: TaskEntity }) {
  const { t } = useTranslation();
  const router = useRouter();
  const remove = useDeleteTask({
    onSuccess: () => router.back(),
    onError: () => Alert.alert(t('tasks.dialog.deleteFailed')),
  });

  return (
    <MenuView
      title={task.title}
      actions={[
        {
          id: 'delete',
          title: t('tasks.dialog.delete'),
          image: 'trash',
          attributes: { destructive: true },
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event !== 'delete') return;
        Alert.alert(
          t('tasks.dialog.deleteTitle', { title: task.title }),
          t('tasks.dialog.deleteDescription'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('tasks.dialog.delete'),
              style: 'destructive',
              onPress: () => remove.mutate(task.id),
            },
          ],
        );
      }}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={t('tasks.mobile.actions')}
        className="size-9 items-center justify-center"
      >
        <Icon as={Ellipsis} size={22} className="text-foreground" />
      </View>
    </MenuView>
  );
}
