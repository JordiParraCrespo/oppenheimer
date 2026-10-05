import { type SlugStatus, useDebouncedValue } from '@oppenheimer/design-system-web';
import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import { useCheckSlug } from '@oppenheimer/frontend-consumer/react';

/**
 * The availability verdict for a workspace address: `checking` while typing
 * (debounced) or in flight, then `ok` or `taken` from
 * `POST /organizations/check-slug`. Between keystroke and request it stays
 * `checking`, never the previous verdict, or Continue gets pressed on a name
 * that is gone. A failed check returns the error, neither `taken` nor an
 * endless `checking`; the caller shows it and keeps Continue disabled.
 */
export function useAddressCheck(address: string): { status: SlugStatus; error: Error | null } {
  const debounced = useDebouncedValue(
    address,
    CONSUMER_CONFIG.organizations.addressCheckDebounceMs,
  );
  const settled = debounced === address;
  // Nothing to ask until the reader stops typing, and nothing to ask about an
  // empty address: the query holds `undefined` and does not fetch.
  const { data, isFetching, error } = useCheckSlug(settled && debounced ? debounced : undefined);

  if (!address) return { status: 'idle', error: null };
  if (error && settled) return { status: 'idle', error };
  if (!settled || isFetching || data === undefined) return { status: 'checking', error: null };
  return { status: data ? 'ok' : 'taken', error: null };
}
