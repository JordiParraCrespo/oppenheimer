import { createQueryPersistOptions, defaultQueryClientOptions } from '@oppenheimer/frontend/react';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { createMMKV } from 'react-native-mmkv';

export const queryClient = new QueryClient({
  // A cold start is the common case on mobile, so lists are worth keeping for
  // a few minutes before refetching.
  defaultOptions: defaultQueryClientOptions(1000 * 60 * 5),
});

/**
 * Writes the query cache to MMKV so a relaunch renders from cache. Sensitive
 * features are filtered out by `createQueryPersistOptions` — tokens stay in
 * expo-secure-store.
 */
const queryCache = createMMKV({ id: 'oppenheimer.query-cache' });

const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => queryCache.getString(key) ?? null,
    setItem: (key, value) => {
      queryCache.set(key, value);
    },
    removeItem: (key) => {
      queryCache.remove(key);
    },
  },
  key: 'oppenheimer.query-cache',
});

export const persistOptions = {
  persister,
  // The runtime version of the binary, so an OTA update or a new build starts
  // from a clean cache rather than hydrating stale response shapes.
  ...createQueryPersistOptions(Constants.expoConfig?.version ?? 'dev'),
};
