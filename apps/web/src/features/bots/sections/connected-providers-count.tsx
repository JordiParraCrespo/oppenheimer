import { useModelProviders } from '@oppenheimer/frontend-consumer/react';

/**
 * How many providers the workspace has a key or a sign-in for, for the
 * Providers tab's count: subscribed here, at the leaf, narrowed to the
 * number. Nothing while the list loads, never a 0 it has not been told.
 */
export function ConnectedProvidersCount() {
  const { data: connected } = useModelProviders({
    select: (rows) => rows.filter((row) => row.configured).length,
  });
  return connected === undefined ? null : connected;
}
