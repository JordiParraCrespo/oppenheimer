import { createFileRoute } from '@tanstack/react-router';
import { OnboardingReadyScreen } from '@/features/organizations/screens/onboarding-ready';

export const Route = createFileRoute('/_auth/onboarding/ready')({
  component: OnboardingReadyScreen,
});
