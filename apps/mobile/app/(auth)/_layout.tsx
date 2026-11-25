import { THEME } from '@oppenheimer/frontend-mobile/theme';
import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';

/**
 * Every auth screen past Welcome keeps the system's navigation bar,
 * transparent, for its back button: on iOS 26 that is Liquid Glass, with the
 * swipe back and the long-press history the platform gives it. Welcome draws
 * full bleed under the status bar, so it has none.
 */
export default function AuthLayout() {
  const { colorScheme } = useColorScheme();

  // Each screen paints its own background through the kit's `AuthLayout`; this
  // is only what shows behind a push transition, so it takes the same token.
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: {
          backgroundColor: THEME[colorScheme === 'dark' ? 'dark' : 'light'].background,
        },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
