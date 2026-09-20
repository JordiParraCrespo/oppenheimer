import { createFileRoute } from '@tanstack/react-router';
import { OnboardingScreen } from '@/features/organizations/screens/onboarding';

/**
 * The recovery path for a signed-in account with no workspace: it creates one
 * (sign-up normally does that itself). The guard is on the parent route.
 */
export const Route = createFileRoute('/onboarding/')({
  component: OnboardingPage,
});

function OnboardingPage() {
  return <OnboardingScreen />;
}
