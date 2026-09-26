import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettingsScreen } from '@/features/profile/screens/profile-settings';

/**
 * Settings → Profile: the account's own facts, how it signs in, and deleting
 * it. `?emailChanged=1` is where the link that moves the account to a new
 * address lands (the API names this URL when it sends the link), and the
 * screen says so. Unknown keys are carried through, as `__root.tsx` asks.
 */
export const Route = createFileRoute('/_authenticated/settings/profile')({
  component: ProfileSettingsScreen,
  validateSearch: (search: Record<string, unknown>): { emailChanged?: true } => ({
    ...search,
    emailChanged: search.emailChanged === 1 || search.emailChanged === '1' ? true : undefined,
  }),
});
