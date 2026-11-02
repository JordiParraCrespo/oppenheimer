import { useState } from 'react';

/** Ask the service worker to check now. The stored state changes when it is done. */
export function useRefresh() {
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'refresh' });
    } finally {
      setRefreshing(false);
    }
  }

  return { refreshing, refresh };
}
