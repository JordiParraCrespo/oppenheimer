import '../global.css';
import 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

import { MobileRoot } from '@oppenheimer/design-system-mobile/mobile-root';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, vars } from 'nativewind';
import * as React from 'react';
import { Text, View } from 'react-native';
import { NAV_THEME } from '../lib/theme';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? darkVars : lightVars;
  const isDark = colorScheme === 'dark';

  return (
    <MobileRoot>
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
      <View
        style={vars(theme)}
        className={isDark ? 'dark flex-1 bg-background' : 'flex-1 bg-background'}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)',
            },
            headerTintColor: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)',
            contentStyle: {
              backgroundColor: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)',
            },
            headerTitle(props) {
              const title =
                typeof props.children === 'string'
                  ? props.children
                  : typeof props.children === 'number'
                    ? String(props.children)
                    : '';

              return <Text className="text-xl font-medium text-foreground">{title}</Text>;
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerTitle: 'Showcase',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen name="buttons" options={{ headerTitle: 'Buttons' }} />
          <Stack.Screen name="components/[slug]" options={{ headerTitle: 'Component' }} />
        </Stack>
      </View>
    </ThemeProvider>
    </MobileRoot>
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
