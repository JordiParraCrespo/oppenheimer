import '../global.css';
import '../lib/i18n';
import 'react-native-gesture-handler';
import 'reflect-metadata';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

import { Button } from '@oppenheimer/design-system-mobile/button';
import { MobileRoot } from '@oppenheimer/design-system-mobile/mobile-root';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { OppenheimerProvider, useAuthState, useSessionRestore } from '@oppenheimer/frontend/react';
import { ThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, vars } from 'nativewind';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { ErrorBoundary } from '../components/error-boundary';
import { AppErrorFallback, ScreenErrorFallback } from '../components/error-fallback';
import { ScreenViewTracker } from '../lib/analytics';
import { configManager } from '../lib/config/config-manager';
import { ConfigManagerContext } from '../lib/config/use-config';
import { app } from '../lib/oppenheimer';
import { initPurchases } from '../lib/purchases';
import { persistOptions, queryClient } from '../lib/query';
import { NAV_THEME } from '../lib/theme';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? darkVars : lightVars;
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    void configManager.load();
    void initPurchases();
  }, []);

  return (
    <ErrorBoundary fallback={() => <AppErrorFallback />}>
      <MobileRoot>
        <ConfigManagerContext.Provider value={configManager}>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions as never}>
            <OppenheimerProvider app={app}>
              <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
                <View
                  style={vars(theme)}
                  className={isDark ? 'dark flex-1 bg-background' : 'flex-1 bg-background'}
                >
                  <StatusBar style={isDark ? 'light' : 'dark'} />
                  <ScreenViewTracker />
                  <ErrorBoundary fallback={(reset) => <ScreenErrorFallback onReset={reset} />}>
                    <AuthGate />
                  </ErrorBoundary>
                </View>
              </ThemeProvider>
            </OppenheimerProvider>
          </PersistQueryClientProvider>
        </ConfigManagerContext.Provider>
      </MobileRoot>
    </ErrorBoundary>
  );
}

function AuthGate() {
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

const lightVars = {
  '--background': '0 0% 100%',
  '--foreground': '0 0% 3.9%',
  '--card': '0 0% 100%',
  '--card-foreground': '0 0% 3.9%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '0 0% 3.9%',
  '--primary': '0 0% 9%',
  '--primary-foreground': '0 0% 98%',
  '--secondary': '0 0% 96.1%',
  '--secondary-foreground': '0 0% 9%',
  '--muted': '0 0% 96.1%',
  '--muted-foreground': '0 0% 45.1%',
  '--accent': '0 0% 96.1%',
  '--accent-foreground': '0 0% 9%',
  '--destructive': '0 84.2% 60.2%',
  '--destructive-foreground': '0 0% 98%',
  '--border': '0 0% 89.8%',
  '--input': '0 0% 89.8%',
  '--ring': '0 0% 63%',
  '--radius': '0.625rem',
} as const;

const darkVars = {
  '--background': '0 0% 3.9%',
  '--foreground': '0 0% 98%',
  '--card': '0 0% 3.9%',
  '--card-foreground': '0 0% 98%',
  '--popover': '0 0% 3.9%',
  '--popover-foreground': '0 0% 98%',
  '--primary': '0 0% 98%',
  '--primary-foreground': '0 0% 9%',
  '--secondary': '0 0% 14.9%',
  '--secondary-foreground': '0 0% 98%',
  '--muted': '0 0% 14.9%',
  '--muted-foreground': '0 0% 63.9%',
  '--accent': '0 0% 14.9%',
  '--accent-foreground': '0 0% 98%',
  '--destructive': '0 70.9% 59.4%',
  '--destructive-foreground': '0 0% 98%',
  '--border': '0 0% 14.9%',
  '--input': '0 0% 14.9%',
  '--ring': '300 0% 45%',
  '--radius': '0.625rem',
} as const;
