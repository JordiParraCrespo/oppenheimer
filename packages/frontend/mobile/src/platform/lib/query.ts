import {
  createQueryPersistOptions,
  defaultQueryClientOptions,
  type QueryPersistConfig,
} from '@oppenheimer/frontend-core/react';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { createMMKV } from 'react-native-mmkv';

/**
 * A query client whose cache is written to MMKV, so a relaunch renders from
 * cache. A cold start is the common case on mobile, so lists are worth
 * keeping for a few minutes before refetching.
 *
 * Sensitive features are filtered out of storage by `createQueryPersistOptions`;
 * the app names its product's (`CONSUMER_NON_PERSISTED_FEATURES`) through
 * `nonPersistedFeatures`. Tokens never come near this: they stay in
 * expo-secure-store.
 */
export function createQueryPersistence(config: QueryPersistConfig = {}) {
  const queryClient = new QueryClient({
    defaultOptions: defaultQueryClientOptions(1000 * 60 * 5),
  });

  const queryCache = createMMKV({ id: 'oppenheimer.query-cache' });

  const persister = createAsyncStoragePersister({
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

  const persistOptions = {
    persister,
    // The runtime version of the binary, so an OTA update or a new build starts
    // from a clean cache rather than hydrating stale response shapes.
    ...createQueryPersistOptions(Constants.expoConfig?.version ?? 'dev', config),
  };

  return { queryClient, persistOptions };
}
