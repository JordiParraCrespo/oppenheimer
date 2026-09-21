import { createFileRoute } from '@tanstack/react-router';
import { OnboardingHostScreen } from '@/features/hosts/screens/onboarding-host';

/**
 * Carries the installation Connect GitHub wrote, so Ready can name it whether
 * or not this step pairs a machine.
 */
export const Route = createFileRoute('/onboarding/_flow/host')({
  validateSearch: (search: Record<string, unknown>): { installation?: string } => ({
    installation: typeof search.installation === 'string' ? search.installation : undefined,
  }),
  component: HostStep,
});

function HostStep() {
  const { installation } = Route.useSearch();

  return <OnboardingHostScreen installationId={installation} />;
}
