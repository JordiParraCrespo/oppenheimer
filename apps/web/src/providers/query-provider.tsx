import { CONSUMER_NON_PERSISTED_FEATURES } from '@oppenheimer/frontend-consumer/react';
import {
  createQueryPersistOptions,
  defaultQueryClientOptions,
} from '@oppenheimer/frontend-core/react';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import {
  PersistQueryClientProvider,
  removeOldestQuery,
} from '@tanstack/react-query-persist-client';
import { useState } from 'react';

/**
 * `localStorage`, or `undefined` where it isn't usable — Safari private mode
 * throws on access, and an embedded webview may have storage disabled
 * entirely. The persister turns an undefined storage into a no-op, so the app
 * degrades to an in-memory cache instead of failing to boot.
 */
function getStorage(): Storage | undefined {
  try {
    const probe = '__oppenheimer_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const persistOptions = {
  persister: createAsyncStoragePersister({
    storage: getStorage(),
    key: 'oppenheimer.query-cache',
    // localStorage caps out around 5 MB. Rather than lose the whole cache to a
    // quota error, drop the oldest query and try again.
    retry: removeOldestQuery,
  }),
  // The app version, injected by Vite: a release that changes a response shape
  // starts from a clean cache instead of hydrating entries it can't read.
  ...createQueryPersistOptions(__APP_VERSION__, {
    nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
  }),
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: defaultQueryClientOptions(60_000) }),
  );

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
