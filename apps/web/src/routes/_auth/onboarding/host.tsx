import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { OnboardingHostScreen } from '@/features/hosts/screens/onboarding-host';
import { hostStepSearchSchema } from '@/features/organizations/lib/onboarding-search';

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
  validateSearch: hostStepSearchSchema,
  // `beforeLoad`, like Ready's: an address that is not the walk never mounts
  // the step, and `replace` keeps it from becoming the entry Back returns to.
  beforeLoad: ({ search }) => {
    if (!search.walk) throw redirect({ to: '/sessions/new', replace: true });
  },
  component: HostStep,
  // Two code cards side by side need the wide column.
  staticData: { authWidth: 'panel' },
});

/** The walk's links: back to Connect GitHub, on to Ready with what this step paired. */
function HostStep() {
  const { installation, walk } = Route.useSearch();

  return (
    <OnboardingHostScreen
      step={4}
      total={4}
      back={<Link to="/onboarding/github" search={{ walk }} />}
      next={(host) => <Link to="/onboarding/ready" search={{ installation, host, walk }} />}
      skip={<Link to="/onboarding/ready" search={{ installation, walk }} />}
    />
  );
}
