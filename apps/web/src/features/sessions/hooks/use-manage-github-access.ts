import { useStartInstallation } from '@oppenheimer/frontend-consumer/react';

/**
 * "Manage repository access": open the GitHub App's install page in a new tab,
 * with an install state minted for it, so what GitHub sends back can be
 * connected (`POST /installations` refuses a callback without one).
 *
 * Minted on click, not on render — every mint is a key in Redis, and the chip
 * renders on every New session. The tab is opened **before** the mint, in the
 * click itself: popup blockers refuse a `window.open` that follows an `await`.
 * It starts blank with its `opener` cut, which is what the plain
 * `rel="noopener"` link it replaces gave, and is pointed at GitHub once the
 * URL arrives. A failed mint closes it again and leaves the error for the
 * section to show.
 *
 * No effect: an event handler's call, and the navigation is the new tab's.
 */
export function useManageGithubAccess() {
  const { mutate, error, reset } = useStartInstallation();

  return {
    manage: () => {
      const tab = window.open('', '_blank');
      if (tab) tab.opener = null;
      mutate(undefined, {
        onSuccess: ({ url }) => {
          // A blocked popup leaves nowhere to send the reader but here.
          if (tab) tab.location.href = url;
          else window.location.assign(url);
        },
        onError: () => tab?.close(),
      });
    },
    /** Why the last mint failed, until `dismiss`. */
    error,
    dismiss: reset,
  };
}
