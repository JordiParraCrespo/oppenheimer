import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';

export default function AppLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)',
        },
        headerTintColor: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)',
        contentStyle: {
          backgroundColor: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerTitle: 'Oppenheimer', headerShadowVisible: false }}
      />
    </Stack>
  );
}
