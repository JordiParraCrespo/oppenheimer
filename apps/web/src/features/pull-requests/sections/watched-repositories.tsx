import { IconButton, SettingsGroup, SettingsListRow, toast } from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import {
  useSetRepositoryWatch,
  useSuspenseWatchedRepositories,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The repositories the caller watches, one row each in a settings card, its
 * × stops watching it. None is watched until the caller picks it with Watch
 * repositories above. Read under Suspense, in the screen's `QueryState`; a
 * refetch that fails keeps the rows and says so above them.
 */
export function WatchedRepositories() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { data: rows, error } = useSuspenseWatchedRepositories((all) =>
    all.filter((row) => row.watching),
  );
  const unwatch = useSetRepositoryWatch({
    onError: (error) => toast.error(resolveError(error, t('pullRequests.watch.failed')).message),
  });

  return (
    <>
      <ErrorAlert error={error} fallback={t('pullRequests.watch.loadFailed')} />
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
    </>
  );
}
