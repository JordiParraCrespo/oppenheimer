import { createFileRoute } from '@tanstack/react-router';
import { RegisterScreen } from '@/features/auth/screens/register';

export const Route = createFileRoute('/_auth/register')({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    // Set two ways, both of them a redirect the app never saw: the login
    // screen forwards a `signup_disabled` here, and a social *sign-up* that
    // fails comes straight back with its own code.
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { error } = Route.useSearch();

  return <RegisterScreen oauthError={error} />;
}
