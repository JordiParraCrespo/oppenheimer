import { createFileRoute } from '@tanstack/react-router';
import { profileSearchSchema } from '@/features/profile/lib/profile-search';
import { ProfileSettingsScreen } from '@/features/profile/screens/profile-settings';

/**
 * Settings → Profile: the account's own facts, how it signs in, and deleting
 * it. `?emailChanged=1` is how the change-email dialog asks the emailed link
 * to return here, and the screen says so.
 */
export const Route = createFileRoute('/_authenticated/settings/profile')({
  component: ProfileSettingsScreen,
  validateSearch: profileSearchSchema,
});
