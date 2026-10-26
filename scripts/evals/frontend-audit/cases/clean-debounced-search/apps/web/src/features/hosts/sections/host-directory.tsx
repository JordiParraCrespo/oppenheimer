import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HostRows } from '../components/host-rows';
import { HostSearch } from '../components/host-search';

/**
 * Every host the workspace has paired, with a search over their names. The
 * list is short enough to filter in the browser; what reaches it is the
 * settled query, never the half-typed one.
 * Read under Suspense, in the screen's `QueryState`; a refetch that fails
 * keeps the rows and says so above them.
 */
export function HostDirectory() {
  const { t } = useTranslation();
  const { data: hosts, error } = useSuspenseHosts();
  const [query, setQuery] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <HostSearch onChange={setQuery} />
      <ErrorAlert error={error} fallback={t('settings.hosts.failed')} />
      <HostRows hosts={hosts} query={query} />
    </div>
  );
}
