import { createFileRoute } from '@tanstack/react-router';
import { OnboardingWorkspaceScreen } from '@/features/organizations/screens/onboarding-workspace';

export const Route = createFileRoute('/onboarding/_flow/workspace')({
  component: OnboardingWorkspaceScreen,
});
