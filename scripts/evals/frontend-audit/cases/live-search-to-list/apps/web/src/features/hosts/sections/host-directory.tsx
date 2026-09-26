import { SearchInput, Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HostRows } from '../components/host-rows';

/**
 * Every host the workspace has paired, with a search over their names.
 *
 * The list is short enough to filter in the browser, so the search narrows
 * what is already loaded rather than asking the API again.
 */
export function HostDirectory() {
  const { t } = useTranslation();
  const { data: hosts, isPending } = useHosts();
  const [query, setQuery] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('common.search')}
      />
      {isPending ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <HostRows hosts={hosts ?? []} query={query} />
      )}
    </div>
  );
}
