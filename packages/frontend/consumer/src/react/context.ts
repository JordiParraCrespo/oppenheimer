import { useOppenheimerApp } from '@oppenheimer/frontend-core/react';
import { ConsumerApp } from '../di/consumer-app';

/** The product's services, from the same provider `useOppenheimerApp` reads. */
export function useConsumerApp(): ConsumerApp {
  return ConsumerApp.for(useOppenheimerApp());
}
