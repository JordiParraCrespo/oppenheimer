import { Stack } from 'expo-router';
import { WorkspaceGate } from '../../features/organizations/sections/workspace-gate';

/**
 * The signed-in app: the tabs; a session, an employee's chat or an automation pushed over them with the system's
 * navigation bar (its back button is glass on iOS 26); and Account over them
 * as the system's sheet (opened from the avatar at the top of every tab).
 */
export default function AppLayout() {
  return (
    <WorkspaceGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="sessions/[id]"
          options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: '' }}
        />
        <Stack.Screen
          name="bots/[id]"
          options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: '' }}
        />
        <Stack.Screen
          name="automations/[id]"
          options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: '' }}
        />
        <Stack.Screen
          name="account"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </WorkspaceGate>
  );
}
