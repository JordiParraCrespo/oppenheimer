import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryState } from './query-state';

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
      <QueryState>
        <QueryState.Pending>loading</QueryState.Pending>
        <QueryState.Error fallback="Could not load the hosts" />
        <QueryState.Data>
          <Hosts fetch={fetch} />
        </QueryState.Data>
      </QueryState>
    </QueryClientProvider>,
  );
}

describe('QueryState around a Suspense read', () => {
  it('draws Pending, and only Pending, until the first answer', async () => {
    show(() => new Promise(() => {}));
    expect(await screen.findByText('loading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('draws a first failure on Error, not Pending', async () => {
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

  it('hands a function child the retry that resets the boundary, for a failure said another way', async () => {
    const fetch = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(['optimus']);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <QueryClientProvider client={client}>
        <QueryState>
          <QueryState.Pending>loading</QueryState.Pending>
          <QueryState.Error>
            {(_error, retry) => (
              <button type="button" onClick={retry}>
                Reload
              </button>
            )}
          </QueryState.Error>
          <QueryState.Data>
            <Hosts fetch={fetch} />
          </QueryState.Data>
        </QueryState>
      </QueryClientProvider>,
    );

    const reload = await screen.findByRole('button', { name: 'Reload' });
    await act(async () => fireEvent.click(reload));

    expect(await screen.findByText('optimus')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
