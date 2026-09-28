import { createFileRoute, redirect } from '@tanstack/react-router';
import { type FirstRunWalk, parseWalk } from '@/features/organizations/lib/first-run';
import { OnboardingReadyScreen } from '@/features/organizations/screens/onboarding-ready';

/**
 * The walk's landing. The search is what the steps produced — the
 * installation and host ids, absent for a skipped step — and `walk`; a visit
 * without `walk` is bounced to the console before the page mounts
 * (`features/organizations/lib/first-run.ts`).
 */
export const Route = createFileRoute('/_auth/onboarding/ready')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { installation?: string; host?: string } & FirstRunWalk => ({
    installation: typeof search.installation === 'string' ? search.installation : undefined,
    host: typeof search.host === 'string' ? search.host : undefined,
    ...parseWalk(search),
  }),
  beforeLoad: ({ search }) => {
    if (!search.walk) throw redirect({ to: '/sessions/new', replace: true });
  },
  component: ReadyStep,
});

function ReadyStep() {
  const { installation, host } = Route.useSearch();

  return <OnboardingReadyScreen installationId={installation} hostId={host} />;
}
