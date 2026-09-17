import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useAuthState, useSessionRestore } from '@oppenheimer/frontend-core/react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

export function AuthGate() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthState();
  const { isLoading, isError, isFetching, refetch } = useSessionRestore();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>

      {isError ? (
        // Restoring the session failed (network/server error). Surface it with
        // a retry instead of treating the user as unauthenticated.
        <View
          className="absolute inset-0 z-50 items-center justify-center gap-4 bg-background p-6"
          role="alert"
        >
          <Text className="text-lg font-semibold text-foreground">
            {t('auth.session.errorTitle')}
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            {t('auth.session.errorMessage')}
          </Text>
          <Button onPress={() => refetch()} disabled={isFetching} className="mt-2">
            <Text>{isFetching ? t('auth.session.retrying') : t('auth.session.retry')}</Text>
          </Button>
        </View>
      ) : null}

      {isLoading ? (
        <View className="absolute inset-0 z-50 items-center justify-center bg-background">
          <ActivityIndicator size="large" />
        </View>
      ) : null}
    </>
  );
}
