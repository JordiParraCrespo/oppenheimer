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

/** Every key in the cache, in insertion order. */
export const cachedKeys = (client: QueryClient) =>
  client
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey as readonly unknown[]);

export const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false;

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.length <= key.length && same(key.slice(0, prefix.length), prefix);

/** The name of the factory function that builds `key` from `args`, if any does. */
export function factoryFor(
  keys: Record<string, unknown>,
  key: readonly unknown[],
  args: unknown[],
): string | undefined {
  for (const [name, value] of Object.entries(keys)) {
    if (typeof value !== 'function') continue;
    try {
      if (same(value(...args), key)) return name;
    } catch {
      // A factory with a different signature: not this one.
    }
  }
  return undefined;
}

/** Look an export up by name, so a missing one fails an assertion, not the import. */
export function exported<T>(module: Record<string, unknown>, name: string): T {
  const value = module[name];
  if (value === undefined) throw new Error(`\`${name}\` is not exported from the react entry`);
  return value as T;
}
