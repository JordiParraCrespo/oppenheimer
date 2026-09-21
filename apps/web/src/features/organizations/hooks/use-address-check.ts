import type { SlugStatus } from '@oppenheimer/design-system-web';
import { useCheckSlug } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';

/** How long the field stays quiet after a keystroke before it asks the API. */
const DEBOUNCE_MS = 400;

/**
 * The availability verdict for a workspace address, as the field shows it:
 * `checking` while the reader is still typing or the answer is in flight, then
 * `ok` or `taken` from `POST /organizations/check-slug`.
 *
 * Typing is debounced so a word costs one request rather than one per letter.
 * Between the keystroke and the request the status stays `checking`, never the
 * previous verdict — showing "available" under an address nobody has asked
 * about yet is how someone ends up pressing Continue on a name that is gone.
 *
 * A failed check reports `checking` rather than `taken`: the step gates
 * Continue on `ok`, so an unreachable API holds the reader still instead of
 * telling them an address they could have is already claimed.
 */
export function useAddressCheck(address: string): SlugStatus {
  const [debounced, setDebounced] = useState(address);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(address), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [address]);

  const settled = debounced === address;
  const { data, isFetching, isError } = useCheckSlug(debounced, {
    enabled: settled && debounced.length > 0,
  });

  if (!address) return 'idle';
  if (!settled || isFetching || isError || data === undefined) return 'checking';
  return data ? 'ok' : 'taken';
}
