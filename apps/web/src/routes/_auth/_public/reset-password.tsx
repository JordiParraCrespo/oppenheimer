import { createFileRoute } from '@tanstack/react-router';
import { resetPasswordSearchSchema } from '@/features/auth/lib/search';
import { ResetPasswordScreen } from '@/features/auth/screens/reset-password';

export const Route = createFileRoute('/_auth/_public/reset-password')({
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordPage,
  staticData: { legalNoteKey: 'auth.resetPassword.legal' },
});

function ResetPasswordPage() {
  const { token, error, email } = Route.useSearch();

  return <ResetPasswordScreen token={token} linkError={error} email={email} />;
}
