import { useStartInstallation } from '@oppenheimer/frontend-consumer/react';

/**
 * "Manage repository access": open the GitHub App's install page in a new tab
 * with a minted install state (`POST /installations` refuses a callback
 * without one). Minted on click, not render: every mint is a Redis key and the
 * chip renders on every New session. The tab opens **before** the mint, in the
 * click, because popup blockers refuse a `window.open` after an `await`; it
 * starts blank with `opener` cut and is pointed at GitHub once the URL
 * arrives. A failed mint closes it and leaves the error to the section.
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
