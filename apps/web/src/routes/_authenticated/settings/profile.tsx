import { createFileRoute } from '@tanstack/react-router';
import { profileSearchSchema } from '@/features/profile/lib/profile-search';
import { ProfileSettingsScreen } from '@/features/profile/screens/profile-settings';

/** Settings → Profile: the account's own facts, how it signs in, and deleting it. */
export const Route = createFileRoute('/_authenticated/settings/profile')({
  component: ProfileSettingsScreen,
  validateSearch: profileSearchSchema,
});
