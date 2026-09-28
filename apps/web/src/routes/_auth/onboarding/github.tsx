import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { githubCallbackSearchSchema } from '@/features/installations/lib/github-install';
import { OnboardingGithubScreen } from '@/features/installations/screens/onboarding-github';
import {
  installUrlCarryingWalk,
  walkFromState,
  walkParam,
} from '@/features/organizations/lib/first-run';

/**
 * Step 3. GitHub returns here after an install with `installation_id`, `code`
 * and the `state` the API minted, parsed at the boundary and dropped once
 * exchanged (all one-shot). The walk rides as the prefix of `state`, the one
 * value GitHub echoes: the route reads it off, hands the screen the bare
 * nonce, pins it on the install URL on the way out and keeps it through the
 * rewrite.
 */
export const Route = createFileRoute('/_auth/onboarding/github')({
  validateSearch: z.preprocess(
    walkFromState,
    githubCallbackSearchSchema.extend({ walk: walkParam }),
  ),
  component: GithubStep,
});

function GithubStep() {
  const navigate = useNavigate();
  // The search keeps GitHub's snake_case keys because it is the URL; the
  // rename to the shared schema's name happens here, at the boundary.
  const { installation_id: githubInstallationId, code, state, walk } = Route.useSearch();

  return (
    <OnboardingGithubScreen
      githubInstallationId={githubInstallationId}
      code={code}
      state={state}
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
