import { sanitizeRedirect } from '@oppenheimer/frontend-web';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginScreen } from '@/features/auth/screens/login';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; email?: string; error?: string } => ({
    redirect: sanitizeRedirect(search.redirect),
    // Prefills the form for an invitee who already has an account.
    email: typeof search.email === 'string' ? search.email : undefined,
    // Better Auth appends `?error=<code>` when a social round-trip fails, and
    // this is the screen it comes back to. Naming it here is what keeps it:
    // `validateSearch` *replaces* the route's search, so a param it does not
    // return is dropped before the component can read it.
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
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
