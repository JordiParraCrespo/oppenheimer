import { openPendingTab } from '../lib/pending-tab';

/**
 * What `useOpenMinted` needs of a mutation that mints an address: React
 * Query's own shape, so a product package's hook goes in as it is and the kit
 * never imports the product.
 */
export interface MintAddress {
  mutate: (
    variables: undefined,
    callbacks: { onSuccess: (minted: { url: string }) => void; onError: () => void },
  ) => void;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Mint an address on click, then leave for it. The address carries something
 * single-use (an install state), so it cannot be an `href` at render.
 *
 * - `self` leaves in this tab, through `urlFor` (the caller's say over the
 *   address, such as a prefix the round trip must keep).
 * - `tab` opens the new tab **before** the mint, in the click, because popup
 *   blockers refuse a `window.open` after an `await`; a failed mint closes it.
 *   `onReturn` runs when the reader comes back to this one.
 */
export function useOpenMinted(
  mint: MintAddress,
  options:
    | { target: 'self'; urlFor?: (url: string) => string }
    | { target: 'tab'; onReturn?: () => void },
) {
  return {
    open: () => {
      if (options.target === 'self') {
        const urlFor = options.urlFor ?? ((url: string) => url);
        mint.mutate(undefined, {
          onSuccess: ({ url }) => window.location.assign(urlFor(url)),
          onError: () => {},
        });
        return;
      }
      const tab = openPendingTab({ onReturn: options.onReturn });
      mint.mutate(undefined, { onSuccess: ({ url }) => tab.go(url), onError: () => tab.close() });
    },
    /** True while the address is being minted, so the trigger cannot be pressed twice. */
    isOpening: mint.isPending,
    /** Why the last mint failed, until `dismiss`. */
    error: mint.error,
    dismiss: mint.reset,
  };
}
