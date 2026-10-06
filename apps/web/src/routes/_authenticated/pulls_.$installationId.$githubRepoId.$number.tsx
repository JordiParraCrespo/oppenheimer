import { createFileRoute } from '@tanstack/react-router';
import {
  pullRequestPane,
  pullRequestSearchSchema,
} from '@/features/pull-requests/lib/pull-request-search';
import { PullRequestScreen } from '@/features/pull-requests/screens/pull-request';

/**
 * A pull request, by the installation that reaches it, the repository and its
 * number: the address GitHub's own data has, since nothing here mirrors it.
 * Un-nested from the Pull requests layout, whose `wide` would frame every
 * view alike, while the sidebar stays on Pull requests. Each view is a page at
 * its own measure (`pullRequestPane`), read off `?view=`.
 */
export const Route = createFileRoute(
  '/_authenticated/pulls_/$installationId/$githubRepoId/$number',
)({
  validateSearch: pullRequestSearchSchema,
  component: PullRequestRoute,
  staticData: { pane: (search) => pullRequestPane(search.view) },
});

function PullRequestRoute() {
  const { installationId, githubRepoId, number } = Route.useParams();
  const { view } = Route.useSearch();
  const address = { installationId, githubRepoId: Number(githubRepoId), number: Number(number) };
  return (
    <PullRequestScreen
      key={`${installationId}/${githubRepoId}/${number}`}
      address={address}
      view={view ?? 'briefing'}
    />
  );
}
