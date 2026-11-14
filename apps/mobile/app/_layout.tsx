import '../global.css';
import '@oppenheimer/frontend-mobile/i18n';
import 'react-native-gesture-handler';
import 'reflect-metadata';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

import { MobileRoot } from '@oppenheimer/design-system-mobile/mobile-root';
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import {
  AppErrorFallback,
  ErrorBoundary,
  NAV_THEME,
  ScreenErrorFallback,
  ScreenViewTracker,
} from '@oppenheimer/frontend-mobile';
import { ThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';
import { AuthGate } from '../features/auth/screens/auth-gate';
import { app } from '../lib/oppenheimer';
import { persistOptions, queryClient } from '../lib/query';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ErrorBoundary fallback={() => <AppErrorFallback />}>
      <MobileRoot>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions as never}>
          <OppenheimerProvider app={app}>
            <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
              <View className={isDark ? 'dark flex-1 bg-background' : 'flex-1 bg-background'}>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <ScreenViewTracker />
                <ErrorBoundary fallback={(reset) => <ScreenErrorFallback onReset={reset} />}>
                  <AuthGate />
                </ErrorBoundary>
              </View>
            </ThemeProvider>
          </OppenheimerProvider>
        </PersistQueryClientProvider>
      </MobileRoot>
    </ErrorBoundary>
  );
}
