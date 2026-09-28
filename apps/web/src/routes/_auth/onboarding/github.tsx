import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  type GithubInstallCallback,
  parseInstallCallback,
} from '@/features/installations/lib/github-install';
import { OnboardingGithubScreen } from '@/features/installations/screens/onboarding-github';
import {
  type FirstRunWalk,
  installUrlCarryingWalk,
  parseWalk,
  WALK_STATE,
} from '@/features/organizations/lib/first-run';

/**
 * Step 3. GitHub returns here after an install with `installation_id` and
 * `code`, parsed at the boundary and dropped once exchanged (the code is
 * one-shot). The walk comes back under `state`, the one value GitHub echoes,
 * so the route pins it on the install URL and keeps it through the rewrite.
 */
export const Route = createFileRoute('/_auth/onboarding/github')({
  validateSearch: (search: Record<string, unknown>): GithubInstallCallback & FirstRunWalk => ({
    ...parseInstallCallback(search),
    ...parseWalk(search.state === WALK_STATE ? { walk: true } : search),
  }),
  component: GithubStep,
});

function GithubStep() {
  const navigate = useNavigate();
  // The search keeps GitHub's snake_case keys because it is the URL; the
  // rename to the shared schema's name happens here, at the boundary.
  const { installation_id: githubInstallationId, code, walk } = Route.useSearch();

  return (
    <OnboardingGithubScreen
      githubInstallationId={githubInstallationId}
      code={code}
      installUrlFor={(url) => (walk ? installUrlCarryingWalk(url) : url)}
      onExchanged={() =>
        navigate({ to: '/onboarding/github', search: walk ? { walk } : {}, replace: true })
      }
      step={3}
      total={4}
      back={<Link to="/onboarding/workspace" />}
      next={(installation) => <Link to="/onboarding/host" search={{ installation, walk }} />}
      skip={<Link to="/onboarding/host" search={{ walk }} />}
    />
  );
}
