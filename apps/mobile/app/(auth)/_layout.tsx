import { THEME } from '@oppenheimer/frontend-mobile/theme';
import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';

export default function AuthLayout() {
  const { colorScheme } = useColorScheme();

  // Each screen paints its own background through the kit's `AuthLayout`; this
  // is only what shows behind a push transition, so it takes the same token
  // rather than a hand-written HSL triple that drifted from it.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: THEME[colorScheme === 'dark' ? 'dark' : 'light'].background,
        },
      }}
    >
      {/* The email screen keeps the system's navigation bar, transparent, for
          its back button: on iOS 26 that is Liquid Glass, with the swipe back
          and the long-press history the platform gives it. */}
      <Stack.Screen
        name="login"
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
    </Stack>
  );
}
