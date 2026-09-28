import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { OnboardingWorkspaceScreen } from '@/features/organizations/screens/onboarding-workspace';

/** Step 2. The claim opens the walk, so it is what mints `walk` on the way to GitHub. */
export const Route = createFileRoute('/_auth/onboarding/workspace')({
  component: WorkspaceStep,
});

function WorkspaceStep() {
  const navigate = useNavigate();

  return (
    <OnboardingWorkspaceScreen
      step={2}
      total={4}
      onClaimed={() => navigate({ to: '/onboarding/github', search: { walk: true } })}
    />
  );
}
