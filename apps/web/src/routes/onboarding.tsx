import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

/**
 * Everything under `/onboarding` is for a signed-in account: the recovery
 * screen at the index, and the numbered steps under `_flow`. A signed-out
 * visitor is sent to the login page and returned here.
 */
export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: Outlet,
});
