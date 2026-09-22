import { createFileRoute } from '@tanstack/react-router';
import { OnboardingHostScreen } from '@/features/hosts/screens/onboarding-host';
import { type FirstRunWalk, parseWalk } from '@/features/organizations/lib/first-run';

/**
 * Carries the installation Connect GitHub wrote, so Ready can name it whether
 * or not this step pairs a machine — and the walk, so Ready can tell a reader
 * finishing first-run from one New session sent here to pair a second machine.
 */
export const Route = createFileRoute('/_auth/onboarding/host')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { installation?: string } & FirstRunWalk => ({
    installation: typeof search.installation === 'string' ? search.installation : undefined,
    ...parseWalk(search),
  }),
  component: HostStep,
  // Two code cards side by side need the wide column.
  staticData: { authWidth: 'panel' },
});

function HostStep() {
  const { installation, walk } = Route.useSearch();

  return <OnboardingHostScreen installationId={installation} walk={walk} />;
}
