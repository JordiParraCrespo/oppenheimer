import { createFileRoute, redirect } from '@tanstack/react-router';
import { OnboardingScreen } from '@/features/organizations/screens/onboarding';

/**
 * Where a signed-in account with no workspace starts: it creates a first
 * organization or accepts a pending invitation. A signed-out visitor is sent
 * to the login page and returned here.
 */
export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  return <OnboardingScreen />;
}
