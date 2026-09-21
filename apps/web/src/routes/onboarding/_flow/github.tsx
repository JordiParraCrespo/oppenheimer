import { createFileRoute } from '@tanstack/react-router';
import {
  type GithubInstallCallback,
  parseInstallCallback,
} from '@/features/organizations/lib/github-install';
import { OnboardingGithubScreen } from '@/features/organizations/screens/onboarding-github';

export const Route = createFileRoute('/onboarding/_flow/github')({
  // GitHub returns here after an install with `installation_id` and `code` on
  // the query string. They are parsed at the boundary so the screen never sees
  // a half-typed id, and dropped from the URL once exchanged — the code is
  // one-shot, and leaving it in the address bar invites a replay that fails.
  validateSearch: (search: Record<string, unknown>): GithubInstallCallback =>
    parseInstallCallback(search),
  component: GithubStep,
});

function GithubStep() {
  const { installation_id, code } = Route.useSearch();

  return <OnboardingGithubScreen installationId={installation_id} code={code} />;
}
