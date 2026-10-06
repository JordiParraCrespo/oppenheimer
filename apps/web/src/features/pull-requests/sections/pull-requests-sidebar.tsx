import { RoutineItem, SidebarEmptyRow, SidebarListHead } from '@oppenheimer/design-system-web';
import { Activity, Folder, GitPullRequest, Layers } from '@oppenheimer/design-system-web/icons';
import { usePullRequestQueue, useWatchedRepositories } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The console's sidebar body on Pull requests
 * (`product/versions/mvp/design/version1/PullRequests.dc.html`): the two
 * views, the queue and analytics, then the watched repositories, each a filter
 * on the queue. The queue's count is every open pull request in it, whatever
 * the scope.
 */
export function PullRequestsSidebar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const repo = useSearch({ strict: false, select: (search) => (search as { repo?: string }).repo });
  const { data: total } = usePullRequestQueue('mine', {
    select: (queue) => queue.scopes.mine + queue.scopes.requested + queue.scopes.watching,
  });
  const { data: watched } = useWatchedRepositories({
    select: (rows) => rows.filter((row) => row.watching),
  });
  const onQueue = Boolean(matchRoute({ to: '/pulls' }));
  const onAnalytics = Boolean(matchRoute({ to: '/pulls/analytics' }));

  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">
      <SidebarListHead label={t('pullRequests.sidebar.views')} />
      <div className="flex flex-col gap-0.5 px-3 pt-1 pb-3">
        <RoutineItem
          name={t('pullRequests.sidebar.queue')}
          icon={<GitPullRequest />}
          meta={total === undefined ? undefined : String(total)}
          active={onQueue}
          render={<Link to="/pulls" />}
        />
        <RoutineItem
          name={t('pullRequests.sidebar.analytics')}
          icon={<Activity />}
          active={onAnalytics}
          render={<Link to="/pulls/analytics" />}
        />
      </div>

      <SidebarListHead label={t('pullRequests.sidebar.repositories')} count={watched?.length} />
      <div className="flex flex-col gap-0.5 px-3 pt-1">
        <RoutineItem
          name={t('pullRequests.sidebar.allRepositories')}
          icon={<Layers />}
          active={onQueue && !repo}
          render={<Link to="/pulls" search={(prev) => ({ ...prev, repo: undefined })} />}
        />
        {watched?.map((repository) => (
          <RoutineItem
            key={`${repository.installationId}:${repository.githubRepoId}`}
            name={repository.fullName}
            icon={<Folder />}
            active={onQueue && repo === repository.fullName}
            render={
              <Link to="/pulls" search={(prev) => ({ ...prev, repo: repository.fullName })} />
            }
          />
        ))}
        {watched && watched.length === 0 ? (
          <SidebarEmptyRow className="mt-1 ml-1">
            {t('pullRequests.sidebar.noRepositories')}
          </SidebarEmptyRow>
        ) : null}
      </div>
    </div>
  );
}
