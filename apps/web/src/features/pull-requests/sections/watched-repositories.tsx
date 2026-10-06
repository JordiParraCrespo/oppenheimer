import { FilterChip, toast } from '@oppenheimer/design-system-web';
import {
  useSetRepositoryWatch,
  useWatchedRepositories,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { WatchRepositorySearch } from './watch-repository-search';

/**
 * The repositories the caller watches, under the Watching scope: one chip
 * each, its × stops watching it, and Watch repositories searches them all.
 * None is watched until the caller picks it.
 */
export function WatchedRepositories() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { data: watched } = useWatchedRepositories({
    select: (rows) => rows.filter((row) => row.watching),
  });
  const unwatch = useSetRepositoryWatch({
    onError: (error) => toast.error(resolveError(error, t('pullRequests.watch.failed')).message),
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {watched?.map((repository) => (
        <FilterChip
          key={`${repository.installationId}:${repository.githubRepoId}`}
          title={repository.fullName}
          removeLabel={t('pullRequests.watch.unwatch', { name: repository.fullName })}
          onRemove={() => unwatch.mutate({ repository, watching: false })}
        >
          <span className="font-mono">{repository.fullName.split('/').pop()}</span>
        </FilterChip>
      ))}
      <WatchRepositorySearch />
    </div>
  );
}
