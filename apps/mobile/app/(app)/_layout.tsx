import { Stack } from 'expo-router';
import { WorkspaceGate } from '../../features/organizations/sections/workspace-gate';

/**
 * The signed-in app: the tabs, and Account over them as the system's sheet
 * (opened from the avatar at the top of every tab).
 */
export default function AppLayout() {
  return (
    <WorkspaceGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
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
