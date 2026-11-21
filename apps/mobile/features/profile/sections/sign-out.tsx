import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { LogOut } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useErrorMessage, useLogout } from '@oppenheimer/frontend-core/react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

export function SignOut() {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const logout = useLogout({ onSuccess: () => router.replace('/(auth)/welcome') });

  return (
    <View className="gap-2">
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-card">
        <Pressable
          accessibilityRole="button"
          disabled={logout.isPending}
          onPress={() => logout.mutate()}
          className="h-12 flex-row items-center gap-3 px-4 active:bg-accent"
        >
          <Icon as={LogOut} size={17} className="text-destructive" />
          <Text variant="body" tone="destructive">
            {t('nav.logOut')}
          </Text>
        </Pressable>
      </View>
      {logout.error ? (
        <View className="px-1">
          <Text role="alert" variant="caption" tone="destructive">
            {resolveError(logout.error, t('nav.logOutFailed')).message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
