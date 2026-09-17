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
  ConfigManagerContext,
  configManager,
  ErrorBoundary,
  initPurchases,
  NAV_THEME,
  ScreenErrorFallback,
  ScreenViewTracker,
} from '@oppenheimer/frontend-mobile';
import { ThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, vars } from 'nativewind';
import { useEffect } from 'react';
import { View } from 'react-native';
import { AuthGate } from '../features/auth/screens/auth-gate';
import { app } from '../lib/oppenheimer';
import { persistOptions, queryClient } from '../lib/query';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? darkVars : lightVars;
  const isDark = colorScheme === 'dark';

  // Synchronises with systems outside React: the remote config manager and
  // the RevenueCat purchases SDK, both initialised once per app launch.
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
