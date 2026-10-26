import { SidebarSearch } from '@oppenheimer/design-system-web';
import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HostRows } from '../components/host-rows';

/**
 * Every host the workspace has paired, with a search over their names.
 *
 * The list is short enough to filter in the browser, so the search narrows
 * what is already loaded rather than asking the API again.
 * Read under Suspense, in the screen's `QueryState`; a refetch that fails
 * keeps the rows and says so above them.
 */
export function HostDirectory() {
  const { t } = useTranslation();
  const { data: hosts, error } = useSuspenseHosts();
  const [query, setQuery] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <SidebarSearch
        value={query}
        onValueChange={setQuery}
        placeholder={t('sessions.new.host.search')}
        aria-label={t('sessions.new.host.search')}
      />
      <ErrorAlert error={error} fallback={t('settings.hosts.failed')} />
      <HostRows hosts={hosts} query={query} />
    </div>
  );
}
