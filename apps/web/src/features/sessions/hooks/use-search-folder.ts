import { useHostFolders } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';
import { expandPath } from '../lib/folder-path';

/**
 * Turn an address's `?path=~/…` into the host's absolute path once the host
 * has said where its home is: Settings' **Open terminal** names `~`, and a
 * session can only be started in a path the host knows. Applied once per host
 * and path; a pick by hand after it stays.
 */
export function useSearchFolder(
  hostId: string,
  path: string,
  onResolved: (path: string, home: string) => void,
) {
  const { data: home } = useHostFolders(hostId, null, { select: (listing) => listing.home });
  const applied = useRef<string | null>(null);

  // The host's answer arrives from outside React; the draft is told once.
  useEffect(() => {
    const key = `${hostId}:${path}`;
    if (!home || applied.current === key) return;
    const absolute = expandPath(path, home);
    if (!absolute) return;
    applied.current = key;
    onResolved(absolute, home);
  }, [hostId, path, home, onResolved]);
}
