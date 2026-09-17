import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordScreen } from '@/features/auth/screens/reset-password';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { token?: string; error?: string; email?: string } => ({
    token: (search.token as string) || undefined,
    error: (search.error as string) || undefined,
    email: (search.email as string) || undefined,
  }),
  component: ResetPasswordPage,
  staticData: { legalNoteKey: 'auth.resetPassword.legal' },
});

function ResetPasswordPage() {
  const { token, error, email } = Route.useSearch();

  return <ResetPasswordScreen token={token} linkError={error} email={email} />;
}
