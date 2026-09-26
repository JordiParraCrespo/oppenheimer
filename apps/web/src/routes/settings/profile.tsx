import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettingsScreen } from '@/features/profile/screens/profile-settings';

/** Settings → Profile: the account's own facts. */
export const Route = createFileRoute('/settings/profile')({
  component: ProfileSettingsScreen,
});
