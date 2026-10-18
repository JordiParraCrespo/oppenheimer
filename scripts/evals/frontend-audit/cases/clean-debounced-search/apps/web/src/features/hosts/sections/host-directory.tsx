import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { HostRows } from '../components/host-rows';
import { HostSearch } from '../components/host-search';

/**
 * Every host the workspace has paired, with a search over their names. The
 * list is short enough to filter in the browser; what reaches it is the
 * settled query, never the half-typed one.
 * Nothing is drawn under the search until the list first answers.
 */
export function HostDirectory() {
  const { data: hosts, isPending } = useHosts();
  const [query, setQuery] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <HostSearch onChange={setQuery} />
      {isPending ? null : <HostRows hosts={hosts ?? []} query={query} />}
    </div>
  );
}
