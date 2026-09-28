import { createFileRoute } from '@tanstack/react-router';
import { type FirstRunWalk, parseWalk } from '@/features/organizations/lib/first-run';
import {
  type GithubInstallCallback,
  isWalkState,
  parseInstallCallback,
} from '@/features/organizations/lib/github-install';
import { OnboardingGithubScreen } from '@/features/organizations/screens/onboarding-github';

export const Route = createFileRoute('/_auth/onboarding/github')({
  // GitHub returns here after an install with `installation_id` and `code` on
  // the query string. They are parsed at the boundary so the screen never sees
  // a half-typed id, and dropped from the URL once exchanged — the code is
  // one-shot, and leaving it in the address bar invites a replay that fails.
  // `walk` rides along with the callback keys: this step sits in the middle of
  // the flow, so it has to hand the fact on to Ready, and `validateSearch`
  // *replaces* the search — a key it does not return is gone by the next
  // navigation. On the return leg it comes back as the prefix of `state`, the
  // one value GitHub echoes, because the install round trip chooses its own
  // query; `state` itself keeps only the API's nonce.
  validateSearch: (search: Record<string, unknown>): GithubInstallCallback & FirstRunWalk => ({
    ...parseInstallCallback(search),
    ...parseWalk(isWalkState(search.state) ? { walk: true } : search),
  }),
  component: GithubStep,
});

function GithubStep() {
  // The search keeps GitHub's snake_case keys because it is the URL; the
  // rename to the shared schema's name happens here, at the boundary.
  const { installation_id: githubInstallationId, code, state, walk } = Route.useSearch();

  return (
    <OnboardingGithubScreen
      githubInstallationId={githubInstallationId}
      code={code}
      state={state}
      walk={walk}
    />
  );
}
