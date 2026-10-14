import {
  IconButton,
  SettingsGroup,
  SettingsListRow,
  Skeleton,
  toast,
} from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import {
  useSetRepositoryWatch,
  useWatchedRepositories,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The repositories the caller watches, one row each in a settings card, its
 * × stops watching it. None is watched until the caller picks it with Watch
 * repositories above.
 */
export function WatchedRepositories() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const watched = useWatchedRepositories({
    select: (rows) => rows.filter((row) => row.watching),
  });
  const unwatch = useSetRepositoryWatch({
    onError: (error) => toast.error(resolveError(error, t('pullRequests.watch.failed')).message),
  });

  return (
    <QueryState query={watched}>
      <QueryState.Pending>
        <Skeleton className="h-26 w-full" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('pullRequests.watch.loadFailed')} />
      <QueryState.Data of={watched}>
        {(rows) => (
          <SettingsGroup>
            {rows.length ? (
              rows.map((repository) => (
                <SettingsListRow
                  key={`${repository.installationId}:${repository.githubRepoId}`}
                  align="center"
                  meta={repository.isPrivate ? t('pullRequests.watch.private') : undefined}
                  actions={
                    <IconButton
                      size="sm"
                      aria-label={t('pullRequests.watch.unwatch', { name: repository.fullName })}
                      onClick={() => unwatch.mutate({ repository, watching: false })}
                    >
                      <X />
                    </IconButton>
                  }
                >
                  <span className="font-mono text-sm">{repository.fullName}</span>
                </SettingsListRow>
              ))
            ) : (
              <SettingsListRow muted>{t('pullRequests.watch.empty')}</SettingsListRow>
            )}
          </SettingsGroup>
        )}
      </QueryState.Data>
    </QueryState>
  );
}
