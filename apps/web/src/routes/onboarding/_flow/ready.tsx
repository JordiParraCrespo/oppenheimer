import { createFileRoute } from '@tanstack/react-router';
import { OnboardingReadyScreen } from '@/features/organizations/screens/onboarding-ready';

export const Route = createFileRoute('/onboarding/_flow/ready')({
  component: OnboardingReadyScreen,
});
