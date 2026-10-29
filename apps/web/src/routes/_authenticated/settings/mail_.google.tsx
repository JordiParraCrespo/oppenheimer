import { createFileRoute } from '@tanstack/react-router';
import { gmailReturnSearchSchema } from '@/features/mail/lib/gmail-return-search';
import { GmailReturnScreen } from '@/features/mail/screens/gmail-return';

/**
 * Where Google's consent screen sends the browser back (`MAIL_*` in
 * `.env.example`: the redirect URI is `${FRONTEND_URL}/settings/mail/google`).
 * Un-nested from Settings → Mail, which renders no outlet.
 */
export const Route = createFileRoute('/_authenticated/settings/mail_/google')({
  validateSearch: gmailReturnSearchSchema,
  component: GmailReturnScreen,
});
