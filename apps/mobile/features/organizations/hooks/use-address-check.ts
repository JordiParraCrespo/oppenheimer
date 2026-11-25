import { useDebouncedValue } from '@oppenheimer/design-system-mobile';
import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import { useCheckSlug } from '@oppenheimer/frontend-consumer/react';

export type AddressStatus = 'idle' | 'checking' | 'ok' | 'taken';

/**
 * The availability verdict for a workspace address, as the console's step
 * reads it: `checking` while typing (debounced) or in flight, then `ok` or
 * `taken` from `POST /organizations/check-slug`. Between a keystroke and the
 * request it stays `checking`, never the previous verdict, so Continue is
 * never pressed on a name that is gone. A failed check returns the error,
 * neither `taken` nor an endless `checking`.
 */
export function useAddressCheck(address: string): { status: AddressStatus; error: Error | null } {
  const debounced = useDebouncedValue(
    address,
    CONSUMER_CONFIG.organizations.addressCheckDebounceMs,
  );
  const settled = debounced === address;
  const { data, isFetching, error } = useCheckSlug(settled && debounced ? debounced : undefined);

  if (!address) return { status: 'idle', error: null };
  if (error && settled) return { status: 'idle', error };
  if (!settled || isFetching || data === undefined) return { status: 'checking', error: null };
  return { status: data ? 'ok' : 'taken', error: null };
}
