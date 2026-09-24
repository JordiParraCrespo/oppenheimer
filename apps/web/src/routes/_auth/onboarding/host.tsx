import { createFileRoute, redirect } from '@tanstack/react-router';
import { OnboardingHostScreen } from '@/features/hosts/screens/onboarding-host';
import { type FirstRunWalk, parseWalk } from '@/features/organizations/lib/first-run';

/**
 * Carries the installation Connect GitHub wrote, so Ready can name it whether
 * or not this step pairs a machine — and the walk, which this step now needs
 * for itself.
 *
 * It did not, while New session's host chip sent a finished account here to
 * pair a machine: a step that is also the console's only pairing screen has to
 * stay open. Add host is that screen now, in the console and in a dialog, and
 * its own note says what sending readers here cost — "into a numbered step of
 * a flow they had finished". So step 4 is first-run's alone again, and takes
 * the same guard as the landing it leads to.
 */
export const Route = createFileRoute('/_auth/onboarding/host')({
  validateSearch: (search: Record<string, unknown>): { installation?: string } & FirstRunWalk => ({
    installation: typeof search.installation === 'string' ? search.installation : undefined,
    ...parseWalk(search),
  }),
  // `beforeLoad`, like Ready's: an address that is not the walk never mounts
  // the step, and `replace` keeps it from becoming the entry Back returns to.
  beforeLoad: ({ search }) => {
    if (!search.walk) throw redirect({ to: '/sessions', replace: true });
  },
  component: HostStep,
  // Two code cards side by side need the wide column.
  staticData: { authWidth: 'panel' },
});

function HostStep() {
  const { installation, walk } = Route.useSearch();

  return <OnboardingHostScreen installationId={installation} walk={walk} />;
}
