import { sanitizeRedirect } from '@oppenheimer/frontend-web';
import { createFileRoute } from '@tanstack/react-router';
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
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo, email, error: oauthError } = Route.useSearch();
  return <LoginScreen redirectTo={redirectTo} email={email} oauthError={oauthError} />;
}
