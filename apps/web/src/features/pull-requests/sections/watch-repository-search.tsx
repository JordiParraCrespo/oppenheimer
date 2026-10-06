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
import { Plus } from '@oppenheimer/design-system-web/icons';
import {
  useSetRepositoryWatch,
  useWatchedRepositories,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Watch a repository: a search over the ones the caller does not watch yet; picking one watches it. */
export function WatchRepositorySearch() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: unwatched } = useWatchedRepositories({
    select: (rows) => rows.filter((row) => !row.watching),
  });
  const watch = useSetRepositoryWatch({
    onError: (error) => toast.error(resolveError(error, t('pullRequests.watch.failed')).message),
  });
  const term = query.trim().toLowerCase();
  const options = (unwatched ?? []).filter(
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
      <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
        <Plus />
        {t('pullRequests.watch.add')}
      </PopoverTrigger>
      <ChipSelectPopup width={320} side="bottom" align="start">
        <ChipSelectSearch
          value={query}
          placeholder={label}
          aria-label={label}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div role="listbox" aria-label={label} className="max-h-55 overflow-y-auto">
          {options.length ? (
            options.map((repository) => (
              <ChipSelectItem
                key={`${repository.installationId}:${repository.githubRepoId}`}
                mono
                description={repository.isPrivate ? t('pullRequests.watch.private') : undefined}
                onClick={() => {
                  watch.mutate({ repository, watching: true });
                  setQuery('');
                }}
              >
                {repository.fullName}
              </ChipSelectItem>
            ))
          ) : (
            <ChipSelectEmpty>
              {term
                ? t('pullRequests.watch.noMatch', { query: query.trim() })
                : t('pullRequests.watch.allWatched')}
            </ChipSelectEmpty>
          )}
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}
