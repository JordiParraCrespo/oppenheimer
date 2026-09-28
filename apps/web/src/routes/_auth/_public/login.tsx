import { createFileRoute, redirect } from '@tanstack/react-router';
import { loginSearchSchema } from '@/features/auth/lib/search';
import { LoginScreen } from '@/features/auth/screens/login';

export const Route = createFileRoute('/_auth/_public/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ search }) => {
    // Someone who pressed "Continue with Google" with no account here is not
    // failing to sign in — they are trying to sign up, which the API refuses
    // from this screen on purpose. Hand them the screen that can finish it,
    // rather than an error on the one that cannot.
    if (search.error === 'signup_disabled') {
      throw redirect({ to: '/register', search: { error: search.error }, replace: true });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo, email, error } = Route.useSearch();

  return <LoginScreen redirectTo={redirectTo} email={email} oauthError={error} />;
}
