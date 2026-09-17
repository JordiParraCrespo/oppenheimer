import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { AppShell } from '@oppenheimer/frontend-web';
import { createFileRoute, Navigate, Outlet, redirect } from '@tanstack/react-router';
import { NAV, USER_MENU_LINKS } from '@/lib/nav';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      // `href`, not `pathname`: a deep link's search params are part of where
      // the reader was going (`/settings?section=security`), and dropping them
      // lands them somewhere else after they sign in.
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AuthenticatedShell,
});

/**
 * The product shell is for people who have somewhere to work.
 *
 * Sign-up creates the personal workspace, but the hook is best-effort, so a
 * signed-in account can end up belonging to none — and the screens in here
 * are scoped to a workspace, which for that account is a refusal. Send them to
 * onboarding, where they create it, instead of letting the app tell them on
 * their first screen that they do not have permission to look at it.
 *
 * The redirect waits for a *settled, successful, empty* list. While the query
 * is in flight — including the background refetch that follows creating the
 * workspace, when the cache still holds the `[]` that sent them to onboarding
 * — or if it failed, the shell renders as it always did: guessing "nowhere to
 * work" from an unanswered question would bounce every reader out of the app
 * on a network blip, or straight back to the onboarding screen they just left.
 */
function AuthenticatedShell() {
  const organizations = useOrganizations();

  const settledEmpty =
    organizations.isSuccess && !organizations.isFetching && organizations.data.length === 0;

  if (settledEmpty) return <Navigate to="/onboarding" replace />;

  // The shell names the first organization the caller belongs to. Keeping it
  // on the same list query as General Settings means a saved name or logo is
  // reflected here immediately from the query cache.
  const organization = organizations.data?.[0];

  return (
    <AppShell
      nav={NAV}
      userMenuLinks={USER_MENU_LINKS}
      workspace={organization ? { name: organization.name, logo: organization.logo } : undefined}
    >
      <Outlet />
    </AppShell>
  );
}
