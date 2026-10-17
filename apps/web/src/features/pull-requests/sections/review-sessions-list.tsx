import {
  RoutineItem,
  SidebarListHead,
  SidebarProjectHeader,
  useNow,
} from '@oppenheimer/design-system-web';
import { GitPullRequest } from '@oppenheimer/design-system-web/icons';
import { useReviewSessions } from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { ErrorAlert, formatAge, SidebarSearchField } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pullRequestLink } from '../lib/pull-request-search';
import { reviewGroups } from '../lib/review-session';

/**
 * For review: the reader's review sessions not closed, grouped by repository,
 * each row the pull request it reviews and opening its Chat tab. They are
 * listed here and never under Sessions. The search filters in the browser:
 * the list arrives whole, and the field hands it the settled word. One clock for every row's age. Nothing is drawn
 * until there is a review session, unless the list could not be read.
 */
export function ReviewSessionsList() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const { data: sessions = [], error } = useReviewSessions();
  // A list that could not be read says so; one with nothing in it draws nothing.
  if (sessions.length === 0)
    return error ? (
      <div className="px-3 pt-2">
        <ErrorAlert error={error} fallback={t('pullRequests.reviewSession.listFailed')} />
      </div>
    ) : null;
  const groups = reviewGroups(sessions, query);

  return (
    <div className="flex flex-col pt-2">
      <SidebarListHead label={t('pullRequests.sidebar.forReview')} count={sessions.length} />
      <SidebarSearchField
        onChange={setQuery}
        label={t('pullRequests.sidebar.searchReviews')}
        clearLabel={t('pullRequests.sidebar.clearSearch')}
      />
      {groups.map((group) => {
        const open = !closed.has(group.repository);
        return (
          <div key={group.repository} className="flex flex-col px-3">
            <SidebarProjectHeader
              name={group.repository.split('/').pop()}
              count={group.sessions.length}
              open={open}
              onOpenChange={(next) =>
                setClosed((current) => {
                  const updated = new Set(current);
                  if (next) updated.delete(group.repository);
                  else updated.add(group.repository);
                  return updated;
                })
              }
            />
            {open ? (
              <div className="flex flex-col gap-0.5 pb-1">
                {group.sessions.map((session) => {
                  const link = pullRequestLink(session, 'chat');
                  return (
                    <RoutineItem
                      key={session.sessionId}
                      name={`#${session.number} ${session.title}`}
                      icon={<GitPullRequest />}
                      meta={formatAge(session.createdAt, now, t)}
                      active={Boolean(matchRoute({ to: link.to, params: link.params }))}
                      render={<Link {...link} />}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
