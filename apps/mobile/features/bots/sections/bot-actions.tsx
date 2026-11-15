import MenuView from '@expo/ui/community/menu';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Ellipsis } from '@oppenheimer/design-system-mobile/icons';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteBot } from '@oppenheimer/frontend-consumer/react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

/**
 * The bot's ··· in the navigation bar: the system's own menu, with Delete
 * bot, which asks first in the system's alert, with the console's words.
 */
export function BotActions({ bot }: { bot: BotEntity }) {
  const { t } = useTranslation();
  const router = useRouter();
  const remove = useDeleteBot({
    onSuccess: () => router.back(),
    onError: () => Alert.alert(t('bots.delete.failed')),
  });

  return (
    <MenuView
      title={bot.name}
      actions={[
        {
          id: 'delete',
          title: t('bots.delete.confirm'),
          image: 'trash',
          attributes: { destructive: true },
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event !== 'delete') return;
        Alert.alert(t('bots.delete.title', { name: bot.name }), t('bots.delete.description'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('bots.delete.confirm'),
            style: 'destructive',
            onPress: () => remove.mutate(bot.id),
          },
        ]);
      }}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={t('bots.mobile.actions')}
        className="size-9 items-center justify-center"
      >
        <Icon as={Ellipsis} size={22} className="text-foreground" />
      </View>
    </MenuView>
  );
}
