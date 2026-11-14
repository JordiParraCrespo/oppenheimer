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
    />
  );
}
