import type { SlugStatus } from '@oppenheimer/design-system-web';
import { useEffect, useState } from 'react';

/** Addresses the scaffold treats as taken, so the "taken" state can be seen. */
const TAKEN = new Set(['acme', 'test', 'admin', 'oppenheimer', 'console', 'app']);

/**
 * The availability verdict for a workspace address, as the field shows it:
 * `checking` for a beat after each keystroke, then `ok` or `taken`.
 *
 * Scaffold: the effect synchronises with a timer standing in for the round
 * trip a real check is. It never calls the API; the taken list above is the
 * whole oracle. Swapping the timer for a query is the wiring slice's job.
 */
export function useAddressCheck(address: string): SlugStatus {
  const [status, setStatus] = useState<SlugStatus>('idle');

  useEffect(() => {
    if (!address) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    const timer = setTimeout(() => setStatus(TAKEN.has(address) ? 'taken' : 'ok'), 550);
    return () => clearTimeout(timer);
  }, [address]);

  return status;
}
