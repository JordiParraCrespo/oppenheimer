import { createFileRoute } from '@tanstack/react-router';
import { MailSettingsScreen } from '@/features/mail/screens/mail-settings';

/** Settings → Mail: the reader's own Gmail accounts, for their bots. */
export const Route = createFileRoute('/_authenticated/settings/mail')({
  component: MailSettingsScreen,
});
