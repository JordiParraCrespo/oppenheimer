import { createFileRoute, redirect } from '@tanstack/react-router';
import { type FirstRunWalk, parseWalk } from '@/features/organizations/lib/first-run';
import { OnboardingReadyScreen } from '@/features/organizations/screens/onboarding-ready';

/**
 * What the previous steps produced, carried in the URL.
 *
 * Search params rather than a store: the summary is a page someone can reload,
 * and two ids are cheaper to carry than a first-run store to keep in sync. A
 * step that was skipped passes nothing, which is how its row knows to say so.
 *
 * `walk` is the third fact carried the same way, and it is what makes the flow
 * shown-once. Ready is the only page under `/onboarding` that a finished
 * account has no business on — the workspace step already returns a claimed
 * address to the console, and Connect GitHub and Add host are also New
 * session's pair-a-machine and install-the-App screens, so they stay open.
 * Being finished cannot be the test here, because every legitimate arrival is
 * finished too: the address is claimed by the end of step 2. Having walked
 * here is (`lib/first-run.ts`).
 */
export const Route = createFileRoute('/_auth/onboarding/ready')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { installation?: string; host?: string } & FirstRunWalk => ({
    installation: typeof search.installation === 'string' ? search.installation : undefined,
    host: typeof search.host === 'string' ? search.host : undefined,
    ...parseWalk(search),
  }),
  // In `beforeLoad`, so a URL that is not the walk never mounts the landing
  // and never renders a bounce. `replace`, so the address it refused does not
  // become the entry Back returns to.
  beforeLoad: ({ search }) => {
    if (!search.walk) throw redirect({ to: '/sessions', replace: true });
  },
  component: ReadyStep,
});

function ReadyStep() {
  const { installation, host } = Route.useSearch();

  return <OnboardingReadyScreen installationId={installation} hostId={host} />;
}
