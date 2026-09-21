import { createFileRoute } from '@tanstack/react-router';
import { OnboardingWorkspaceScreen } from '@/features/organizations/screens/onboarding-workspace';

export const Route = createFileRoute('/_auth/onboarding/workspace')({
  component: OnboardingWorkspaceScreen,
});
