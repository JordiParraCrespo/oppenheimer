import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettingsScreen } from '@/features/profile/screens/profile-settings';

/**
 * Settings → Profile: the account's own facts, how it signs in, and deleting
 * it. `?emailChanged=1` is how the change-email dialog asks the emailed link
 * to return here, and the screen says so. Unknown keys are carried through,
 * as `__root.tsx` asks.
 */
export const Route = createFileRoute('/_authenticated/settings/profile')({
  component: ProfileSettingsScreen,
  // The link carries `1`; the router validates its own output again, when
  // the value is already `true` — refusing that stripped it on arrival.
  validateSearch: (search: Record<string, unknown>): { emailChanged?: true } => ({
    ...search,
    emailChanged: [1, '1', true, 'true'].includes(search.emailChanged as never) ? true : undefined,
  }),
});
