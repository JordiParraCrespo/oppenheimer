import { CONSUMER_PERSISTED_FEATURES } from '@oppenheimer/frontend-consumer/react';
import { createQueryPersistence } from '@oppenheimer/frontend-mobile';

// Only the features the consumer product lists are written to the on-device
// cache; credentials and the profile never are.
export const { queryClient, persistOptions } = createQueryPersistence({
  persistedFeatures: CONSUMER_PERSISTED_FEATURES,
});
