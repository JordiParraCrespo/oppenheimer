import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  pullRequestPane,
  pullRequestSearchSchema,
  resolvePullRequestView,
} from '@/features/pull-requests/lib/pull-request-search';
import { PullRequestScreen } from '@/features/pull-requests/screens/pull-request';
import { SessionScreen } from '@/features/sessions/screens/session';

/**
 * A pull request, by the installation that reaches it, the repository and its
 * number: the address GitHub's own data has, since nothing here mirrors it.
 * Un-nested from the Pull requests layout, whose `wide` would frame every
 * view alike, while the sidebar stays on Pull requests. Each view is a page at
 * its own measure (`pullRequestPane`), read off `?view=`. The Chat view is the
 * pull request's review session; its terminal is the sessions feature's, so
 * the route composes the two.
 */
export const Route = createFileRoute(
  '/_authenticated/pulls_/$installationId/$githubRepoId/$number',
)({
  validateSearch: pullRequestSearchSchema,
  component: PullRequestRoute,
  staticData: { pane: (search) => pullRequestPane(pullRequestSearchSchema.parse(search).view) },
});

function PullRequestRoute() {
  const { t } = useTranslation();
  const { installationId, githubRepoId, number } = Route.useParams();
  const { view } = Route.useSearch();
  const address = { installationId, githubRepoId: Number(githubRepoId), number: Number(number) };
  return (
    <PullRequestScreen
      key={`${installationId}/${githubRepoId}/${number}`}
      address={address}
      view={resolvePullRequestView(view)}
      terminal={(sessionId) => (
        <SessionScreen
          key={sessionId}
          sessionId={sessionId}
          composer={t('pullRequests.reviewSession.composer')}
        />
      )}
    />
  );
}
