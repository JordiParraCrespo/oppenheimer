import { defineMutation } from '@oppenheimer/frontend-core/react';
import { useConsumerApp } from './context';

/** This package's mutation hooks, against the consumer app (`defineMutation`). */
export const mutation = defineMutation(useConsumerApp);
