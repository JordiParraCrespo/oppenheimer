import { useSyncExternalStore } from 'react';
import { latencyReadout, subscribeLatencyReadouts } from '../lib/latency-readout';

/** The session terminal's echo readout (`bindLatencyReadout`), when it is on. */
export function useLatencyReadout(sessionId: string): string | undefined {
  return useSyncExternalStore(
    (onChange) => subscribeLatencyReadouts((changed) => changed === sessionId && onChange()),
    () => latencyReadout(sessionId),
  );
}
