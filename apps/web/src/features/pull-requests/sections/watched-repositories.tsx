import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Settings2 } from '@oppenheimer/design-system-web/icons';
import {
  useSetRepositoryWatch,
  useWatchedRepositories,
} from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Manage repositories: every repository the workspace's installations reach,
 * each with a checkbox. No row means watched, so a new repository shows up
 * without anyone opting in.
 */
export function WatchedRepositories() {
  const { t } = useTranslation();
  const repositories = useWatchedRepositories();
  const watch = useSetRepositoryWatch();

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="secondary" size="sm" />}>
        <Settings2 />
        {t('pullRequests.watch.manage')}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-95">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="m-0 font-medium text-fg">{t('pullRequests.watch.title')}</p>
            <p className="m-0 text-sm text-fg-muted">{t('pullRequests.watch.hint')}</p>
          </div>
          <QueryState
            query={repositories}
            pending={<Skeleton className="h-24 w-full" />}
            errorFallback={t('pullRequests.watch.loadFailed')}
          >
            {(rows) => (
              <ul className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0">
                {rows.map((repository) => (
                  <li
                    key={`${repository.installationId}:${repository.githubRepoId}`}
                    className="flex items-center gap-3 rounded-md px-1 py-1.5"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-mono text-sm text-fg">
                        {repository.fullName}
                      </span>
                      <span className="text-xs text-fg-muted">
                        {repository.isPrivate
                          ? t('pullRequests.watch.private')
                          : t('pullRequests.watch.public')}
                      </span>
                    </div>
                    <Checkbox
                      checked={repository.watching}
                      disabled={watch.isPending}
                      aria-label={t('pullRequests.watch.toggle', { name: repository.fullName })}
                      onCheckedChange={(watching: boolean) =>
                        watch.mutate({ repository, watching })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      </PopoverContent>
    </Popover>
  );
}
