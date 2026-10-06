import {
  Button,
  ChipSelectEmpty,
  ChipSelectItem,
  ChipSelectPopup,
  ChipSelectSearch,
  Popover,
  PopoverTrigger,
  toast,
} from '@oppenheimer/design-system-web';
import { Search } from '@oppenheimer/design-system-web/icons';
import {
  useSetRepositoryWatch,
  useWatchedRepositories,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Search repositories to watch: every repository the installations reach, in
 * name order, a check on the watched ones. Picking a row toggles it and the
 * list stays open, so several are chosen in one visit, the way a multi-select
 * quick pick works. A pick shows at once and holds until the refetch lands, so
 * a second click on the same row asks for the opposite of what it shows.
 */
export function WatchRepositorySearch() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<ReadonlyMap<string, boolean>>(new Map());
  const { data: repositories, isPending } = useWatchedRepositories();
  const watch = useSetRepositoryWatch({
    onError: (error) => toast.error(resolveError(error, t('pullRequests.watch.failed')).message),
    onSettled: (_data, _error, { repository }) =>
      setPicks((current) => {
        const next = new Map(current);
        next.delete(keyOf(repository));
        return next;
      }),
  });
  const term = query.trim().toLowerCase();
  const options = (repositories ?? []).filter(
    (row) => !term || row.fullName.toLowerCase().includes(term),
  );
  const label = t('pullRequests.watch.search');

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <Search />
        {t('pullRequests.watch.add')}
      </PopoverTrigger>
      <ChipSelectPopup width={320} maxHeight={320} side="bottom" align="start">
        <ChipSelectSearch
          value={query}
          placeholder={label}
          aria-label={label}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div role="listbox" aria-label={label} aria-multiselectable>
          {options.length ? (
            options.map((repository) => {
              const key = keyOf(repository);
              const watching = picks.get(key) ?? repository.watching;
              return (
                <ChipSelectItem
                  key={key}
                  mono
                  density="menu"
                  selected={watching}
                  description={repository.isPrivate ? t('pullRequests.watch.private') : undefined}
                  onClick={() => {
                    setPicks((current) => new Map(current).set(key, !watching));
                    watch.mutate({ repository, watching: !watching });
                  }}
                >
                  {repository.fullName}
                </ChipSelectItem>
              );
            })
          ) : (
            <ChipSelectEmpty live={isPending}>
              {isPending
                ? t('pullRequests.watch.loading')
                : term
                  ? t('pullRequests.watch.noMatch', { query: query.trim() })
                  : t('pullRequests.watch.none')}
            </ChipSelectEmpty>
          )}
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}

function keyOf(repository: { installationId: string; githubRepoId: number }) {
  return `${repository.installationId}:${repository.githubRepoId}`;
}
