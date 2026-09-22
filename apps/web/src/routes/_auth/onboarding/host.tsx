import { createFileRoute } from '@tanstack/react-router';
import { OnboardingHostScreen } from '@/features/hosts/screens/onboarding-host';

/**
 * Carries the installation Connect GitHub wrote, so Ready can name it whether
 * or not this step pairs a machine.
 */
export const Route = createFileRoute('/_auth/onboarding/host')({
  validateSearch: (search: Record<string, unknown>): { installation?: string } => ({
    installation: typeof search.installation === 'string' ? search.installation : undefined,
  }),
  component: HostStep,
  // Two code cards side by side need the wide column. And not first-run only:
  // pairing a machine has no other screen in version 1 — New session's "no
  // hosts" empty state and the host chip's Add a host both land here — so the
  // flow's gate leaves this step open once first-run is over.
  staticData: { authWidth: 'panel', firstRunOnly: false },
});

function HostStep() {
  const { installation } = Route.useSearch();

  return <OnboardingHostScreen installationId={installation} />;
}
