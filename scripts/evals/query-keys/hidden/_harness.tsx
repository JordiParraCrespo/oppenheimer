// Shared by the hidden specs. Copied next to them into
// packages/frontend/consumer/src/react/__tests__/ when a task is graded, so the
// relative imports below resolve from there.
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { fakeKernel } from './fake-kernel';

export function setup(services: Record<symbol, unknown>) {
  const app = fakeKernel(services);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { queryClient, wrapper };
}

export const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false;

/** Look an export up by name, so a missing one fails an assertion, not the import. */
export function exported<T>(module: Record<string, unknown>, name: string): T {
  const value = module[name];
  if (value === undefined) throw new Error(`\`${name}\` is not exported from the react entry`);
  return value as T;
}
