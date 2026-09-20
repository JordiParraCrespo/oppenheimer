import { createFileRoute } from '@tanstack/react-router';
import { OnboardingHostScreen } from '@/features/hosts/screens/onboarding-host';

export const Route = createFileRoute('/onboarding/_flow/host')({
  component: OnboardingHostScreen,
  // Two code cards side by side need the wide column.
  staticData: { authWidth: 'panel' },
});
