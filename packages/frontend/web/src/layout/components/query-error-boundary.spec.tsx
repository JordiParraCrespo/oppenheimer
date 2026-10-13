import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryErrorBoundary } from './query-error-boundary';

// Partial: the forms concern's index also loads the i18n instance, which
// needs the real `initReactI18next`.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { exists: () => false, t: (key: string) => key },
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const hostsKeys = { all: ['hosts'] as const, list: () => [...hostsKeys.all, 'list'] as const };

function Hosts({ fetch }: { fetch: () => Promise<string[]> }) {
  const { data } = useSuspenseQuery({ queryKey: hostsKeys.list(), queryFn: fetch });
  return <p>{data.join(', ')}</p>;
}

function show(fetch: () => Promise<string[]>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // React logs the error a boundary catches; the assertions are on the screen.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return render(
    <QueryClientProvider client={client}>
      <QueryErrorBoundary fallback="Could not load the hosts">
        <Suspense fallback="loading">
          <Hosts fetch={fetch} />
        </Suspense>
      </QueryErrorBoundary>
    </QueryClientProvider>,
  );
}

describe('QueryErrorBoundary', () => {
  it('lets the Suspense below it hold the place until the first answer', async () => {
    show(() => new Promise(() => {}));
    expect(await screen.findByText('loading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('draws a first failure in place of the read, not its placeholder', async () => {
    show(() => Promise.reject(new Error('boom')));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('loading')).toBeNull();
  });

  it('fetches again on Try again rather than rethrowing the failure it cached', async () => {
    const fetch = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(['optimus', 'build-03']);
    show(fetch);
    await screen.findByRole('alert');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'common.retry' })));

    expect(await screen.findByText('optimus, build-03')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
