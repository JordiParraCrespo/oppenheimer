import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { OnboardingGithubScreen } from '@/features/installations/screens/onboarding-github';
import { installUrlCarryingWalk } from '@/features/organizations/lib/first-run';
import { githubStepSearchSchema } from '@/features/organizations/lib/onboarding-search';

/**
 * Step 3. GitHub returns here after an install with `installation_id`, `code`
 * and the `state` the API minted, parsed at the boundary and dropped once
 * exchanged (all one-shot), and `setup_action`, which says whether it was an
 * install at all. The screen gets the bare nonce; the walk is pinned
 * on the install URL on the way out and kept through the rewrite.
 */
export const Route = createFileRoute('/_auth/onboarding/github')({
  validateSearch: githubStepSearchSchema,
  component: GithubStep,
});

function GithubStep() {
  const navigate = useNavigate();
  // The search keeps GitHub's snake_case keys because it is the URL; the
  // rename to the shared schema's name happens here, at the boundary.
  const {
    installation_id: githubInstallationId,
    code,
    state,
    setup_action: setupAction,
    walk,
  } = Route.useSearch();

  return (
    <OnboardingGithubScreen
      githubInstallationId={githubInstallationId}
      code={code}
      state={state}
      setupAction={setupAction}
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
