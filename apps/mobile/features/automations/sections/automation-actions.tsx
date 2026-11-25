import MenuView from '@expo/ui/community/menu';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Ellipsis } from '@oppenheimer/design-system-mobile/icons';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import {
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useSetAutomationPaused,
} from '@oppenheimer/frontend-consumer/react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, View } from 'react-native';

/**
 * The automation's ··· in the navigation bar, the system's own menu, as the
 * export draws it: Run now, Pause or Resume, Duplicate (which opens the
 * copy), and Delete, which asks first in the system's alert with the
 * console's words. A refusal says so in an alert. While one of them is out
 * the ··· turns into a spinner. `onDeleting` hears a confirmed delete start
 * (`true`) and fail (`false`), so the page can hold the automation on screen
 * while it goes back, instead of drawing it as not found.
 */
export function AutomationActions({
  automation,
  onDeleting,
}: {
  automation: AutomationEntity;
  onDeleting: (deleting: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const failed = (message: string) => () => Alert.alert(message);
  const run = useRunAutomation({ onError: failed(t('automations.mobile.runFailed')) });
  const pause = useSetAutomationPaused({ onError: failed(t('automations.mobile.pauseFailed')) });
  const duplicate = useDuplicateAutomation({
    onSuccess: (copy) => router.replace(`/automations/${copy.id}`),
    onError: failed(t('automations.mobile.duplicateFailed')),
  });
  const remove = useDeleteAutomation({
    onSuccess: () => router.back(),
    onError: () => {
      onDeleting(false);
      Alert.alert(t('automations.deleteDialog.failed'));
    },
  });
  const busy = run.isPending || pause.isPending || duplicate.isPending || remove.isPending;

  return (
    <MenuView
      title={automation.name}
      actions={[
        { id: 'run', title: t('automations.detail.runNow'), image: 'play' },
        automation.isPaused
          ? { id: 'resume', title: t('automations.detail.resume'), image: 'play.circle' }
          : { id: 'pause', title: t('automations.detail.pause'), image: 'pause' },
        {
          id: 'duplicate',
          title: t('automations.detail.duplicate'),
          image: 'plus.square.on.square',
        },
        {
          id: 'delete',
          title: t('automations.detail.delete'),
          image: 'trash',
          attributes: { destructive: true },
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        switch (nativeEvent.event) {
          case 'run':
            run.mutate({ id: automation.id, idempotencyKey: crypto.randomUUID() });
            return;
          case 'pause':
          case 'resume':
            pause.mutate({ id: automation.id, paused: nativeEvent.event === 'pause' });
            return;
          case 'duplicate':
            duplicate.mutate(automation.id);
            return;
          case 'delete':
            Alert.alert(
              t('automations.deleteDialog.title', { name: automation.name }),
              t('automations.deleteDialog.description'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('automations.deleteDialog.confirm'),
                  style: 'destructive',
                  onPress: () => {
                    onDeleting(true);
                    remove.mutate(automation.id);
                  },
                },
              ],
            );
        }
      }}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={t('automations.detail.more')}
        accessibilityState={{ busy }}
        className="size-9 items-center justify-center"
      >
        {busy ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon as={Ellipsis} size={22} className="text-foreground" />
        )}
      </View>
    </MenuView>
  );
}
