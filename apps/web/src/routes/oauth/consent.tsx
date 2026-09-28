import { createFileRoute, redirect } from '@tanstack/react-router';
import { consentSearchSchema } from '@/features/auth/lib/consent';
import { OAuthConsentScreen } from '@/features/auth/screens/oauth-consent';

/**
 * OAuth consent screen.
 *
 * Signing in first is required, so an unauthenticated visitor is bounced to
 * the login page and returned here.
 */
export const Route = createFileRoute('/oauth/consent')({
  validateSearch: consentSearchSchema,
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: `${location.pathname}${location.searchStr}` },
      });
    }
  },
  component: ConsentPage,
});

function ConsentPage() {
  const search = Route.useSearch();

  return <OAuthConsentScreen search={search} />;
}
