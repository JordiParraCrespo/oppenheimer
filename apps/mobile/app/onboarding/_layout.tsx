import { THEME } from '@oppenheimer/frontend-mobile/theme';
import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';

/** The walk after sign-up: name the workspace, then Ready. It has no way back. */
export default function OnboardingLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: {
          backgroundColor: THEME[colorScheme === 'dark' ? 'dark' : 'light'].background,
        },
      }}
    />
  );
}
