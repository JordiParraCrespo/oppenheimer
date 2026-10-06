import { Skeleton } from '@oppenheimer/design-system-web';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequestActivity } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ActivityEntry } from '../components/activity-entry';
import { activityEntries } from '../lib/activity';

/** Under the description, its conversation: commits, comments, reviews and events, oldest first. */
export function PullRequestActivity({
  address,
  base,
}: {
  address: PullRequestAddress;
  base: string;
}) {
  const { t } = useTranslation();
  const activity = usePullRequestActivity(address);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="m-0 text-h4 font-semibold text-fg">
        {t('pullRequests.detail.activity.title')}
      </h2>
      <QueryState
        query={activity}
        pending={<Skeleton className="h-24 w-full" />}
        errorFallback={t('pullRequests.detail.activity.loadFailed')}
      >
        {(items) => {
          const entries = activityEntries(items);
          return entries.length ? (
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {entries.map((entry) => (
                <ActivityEntry key={entry.id} entry={entry} base={base} />
              ))}
            </ol>
          ) : (
            <p className="m-0 text-sm text-fg-muted">{t('pullRequests.detail.activity.empty')}</p>
          );
        }}
      </QueryState>
    </section>
  );
}
