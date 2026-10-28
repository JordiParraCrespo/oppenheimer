import { RoutineItem, SidebarListHead } from '@oppenheimer/design-system-web';
import { Activity, GitPullRequest } from '@oppenheimer/design-system-web/icons';
import { usePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReviewSessionsList } from './review-sessions-list';

/**
 * The console's sidebar body on Pull requests
 * (`product/versions/mvp/design/version1/PullRequests.dc.html`): the two
 * views, the queue and analytics, the section's bots (`bots`, composed by
 * the route), then For review, the reader's review
 * sessions. The queue's count is every open pull
 * request in it, whatever the scope. The repository is picked in the queue's
 * own toolbar, and which repositories are watched is set in Settings.
 */
export function PullRequestsSidebar({ bots }: { bots?: ReactNode }) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const { data: total } = usePullRequestQueue('mine', {
    select: (queue) => queue.scopes.all,
  });

  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">
      <SidebarListHead label={t('pullRequests.sidebar.views')} />
      <div className="flex flex-col gap-0.5 px-3 pt-1 pb-3">
        <RoutineItem
          name={t('pullRequests.sidebar.queue')}
          icon={<GitPullRequest />}
          meta={total === undefined ? undefined : String(total)}
          active={Boolean(matchRoute({ to: '/pulls' }))}
          render={<Link to="/pulls" />}
        />
        <RoutineItem
          name={t('pullRequests.sidebar.analytics')}
          icon={<Activity />}
          active={Boolean(matchRoute({ to: '/pulls/analytics' }))}
          render={<Link to="/pulls/analytics" />}
        />
      </div>
      {bots}
      <ReviewSessionsList />
    </div>
  );
}
