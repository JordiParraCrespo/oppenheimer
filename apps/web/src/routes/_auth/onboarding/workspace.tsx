import { createFileRoute } from '@tanstack/react-router';
import { OnboardingWorkspaceScreen } from '@/features/organizations/screens/onboarding-workspace';

/** Step 2. The screen holds its own first-run gate: it is the one that reads the workspace. */
export const Route = createFileRoute('/_auth/onboarding/workspace')({
  component: OnboardingWorkspaceScreen,
});
