import MenuView from '@expo/ui/community/menu';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Ellipsis } from '@oppenheimer/design-system-mobile/icons';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Share, View } from 'react-native';

/**
 * The session's ··· in the navigation bar: the system's own menu with Share
 * link (the console's address for it) and Delete session, which asks first
 * in the system's alert, with the console's words, and goes back to the list
 * once the delete is sent; the list keeps the row away while its host
 * carries it out.
 */
export function SessionActions({ session, webUrl }: { session: SessionEntity; webUrl: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const close = useCloseSession({
    onError: () => Alert.alert(t('sessions.deleteSession.failed')),
  });

  const confirmDelete = () =>
    Alert.alert(
      t('sessions.deleteSession.title', { name: session.name }),
      session.isFolder
        ? t('sessions.deleteSession.descriptionFolder')
        : session.isCloud
          ? t('sessions.deleteSession.descriptionCloud')
          : t('sessions.deleteSession.description'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('sessions.deleteSession.confirm'),
          style: 'destructive',
          onPress: () => {
            close.mutate({ id: session.id });
            router.back();
          },
        },
      ],
    );

  return (
    <MenuView
      title={session.name}
      actions={[
        { id: 'share', title: t('sessions.mobile.shareLink'), image: 'square.and.arrow.up' },
        {
          id: 'delete',
          title: t('sessions.deleteSession.confirm'),
          image: 'trash',
          attributes: { destructive: true },
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === 'share') {
          void Share.share({ url: `${webUrl}/sessions/${session.id}`, message: session.name });
        }
        if (nativeEvent.event === 'delete') confirmDelete();
      }}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={t('sessions.mobile.actions')}
        className="size-9 items-center justify-center"
      >
        <Icon as={Ellipsis} size={22} className="text-foreground" />
      </View>
    </MenuView>
  );
}
