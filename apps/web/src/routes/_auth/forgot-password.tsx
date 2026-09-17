import { createFileRoute } from '@tanstack/react-router';
import { ForgotPasswordScreen } from '@/features/auth/screens/forgot-password';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
  staticData: { legalNoteKey: 'auth.forgotPassword.legal' },
});

function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
