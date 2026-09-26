import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useEffect, useState } from 'react';

/**
 * The name being typed for a host, starting from its current one. Opening the
 * panel on another host starts the draft over from that host's name.
 */
export function useHostDraft(host: HostEntity) {
  const [draft, setDraft] = useState(host.name);

  useEffect(() => {
    setDraft(host.name);
  }, [host.name]);

  return { draft, setDraft, dirty: draft !== host.name };
}
