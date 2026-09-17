import { CONSUMER_NON_PERSISTED_FEATURES } from '@oppenheimer/frontend-consumer/react';
import { createQueryPersistence } from '@oppenheimer/frontend-mobile';

// Credentials and the profile never reach the on-device cache.
export const { queryClient, persistOptions } = createQueryPersistence({
  nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
});
