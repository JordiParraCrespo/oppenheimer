import { createFileRoute, redirect } from '@tanstack/react-router';
import { OnboardingScreen } from '@/features/organizations/screens/onboarding';

/**
 * The recovery path for a signed-in account with no workspace: it creates one
 * (sign-up normally does that itself). A signed-out visitor is sent to the
 * login page and returned here.
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
