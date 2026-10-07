import { Avatar, AvatarFallback, Skeleton } from '@oppenheimer/design-system-web';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequestActivity } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { commenters } from '../lib/activity';

/** The rail's Comments: who has commented on the conversation, and how often. */
export function PullRequestCommentsSummary({ address }: { address: PullRequestAddress }) {
  const { t } = useTranslation();
  const activity = usePullRequestActivity(address);
  return (
    <QueryState
      query={activity}
      pending={<Skeleton className="h-5 w-32" />}
      errorFallback={t('pullRequests.detail.activity.loadFailed')}
    >
      {(items) => {
        const people = commenters(items);
        return people.length ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {people.map((person) => (
              <li key={person.login} className="flex items-center gap-2.5 text-operate">
                <Avatar size="sm">
                  <AvatarFallback>{person.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-fg">@{person.login}</span>
                <span className="text-sm text-fg-muted">
                  {t('pullRequests.detail.rail.commentCount', { count: person.count })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-fg-muted">{t('pullRequests.detail.rail.noComments')}</p>
        );
      }}
    </QueryState>
  );
}
