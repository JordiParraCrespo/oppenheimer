import { createFileRoute } from '@tanstack/react-router';
import { OnboardingReadyScreen } from '@/features/organizations/screens/onboarding-ready';

/**
 * What the previous steps produced, carried in the URL.
 *
 * Search params rather than a store: the summary is a page someone can reload,
 * and two ids are cheaper to carry than a first-run store to keep in sync. A
 * step that was skipped passes nothing, which is how its row knows to say so.
 */
export const Route = createFileRoute('/onboarding/_flow/ready')({
  validateSearch: (search: Record<string, unknown>): { installation?: string; host?: string } => ({
    installation: typeof search.installation === 'string' ? search.installation : undefined,
    host: typeof search.host === 'string' ? search.host : undefined,
  }),
  component: ReadyStep,
});

function ReadyStep() {
  const { installation, host } = Route.useSearch();

  return <OnboardingReadyScreen installationId={installation} hostId={host} />;
}
