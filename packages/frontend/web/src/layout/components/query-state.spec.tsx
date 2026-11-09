import type { OppenheimerApp } from '@oppenheimer/frontend-core';
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingAnnouncer } from './loading-status';
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

describe('QueryState', () => {
  it('draws Pending, and only Pending, until the first answer', async () => {
    show(() => new Promise(() => {}));
    expect(await screen.findByText('loading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is heard while Pending draws, whether or not its placeholder says so', async () => {
    // A placeholder that forgot its `LoadingStatus` left a screen reader in silence.
    let answer: (hosts: string[]) => void = () => {};
    const client = new QueryClient();
    render(
      <LoadingAnnouncer>
        <QueryClientProvider client={client}>
          <QueryState>
            <QueryState.Pending>loading</QueryState.Pending>
            <QueryState.Error fallback="failed" />
            <QueryState.Data>
              <Hosts fetch={() => new Promise((resolve) => (answer = resolve))} />
            </QueryState.Data>
          </QueryState>
        </QueryClientProvider>
      </LoadingAnnouncer>,
    );
    await screen.findByText('loading');
    expect(screen.getByRole('status').textContent).toBe('common.loading');

    await act(async () => answer(['optimus']));

    expect(await screen.findByText('optimus')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
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

  it('refuses a slot drawn outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<QueryState.Pending>loading</QueryState.Pending>)).toThrow(
      '<QueryState.Pending> is drawn outside a <QueryState>',
    );
  });

  // Regression: a section that throws while rendering shows its failure and
  // nobody hears about it.
  it('offers what its boundary caught to error reporting', async () => {
    const capture = vi.fn();
    const app = { errors: { capture } } as unknown as OppenheimerApp;
    const broken = new TypeError("Cannot read properties of undefined (reading 'name')");
    function Throws(): never {
      throw broken;
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <OppenheimerProvider app={app}>
        <QueryState>
          <QueryState.Pending>loading</QueryState.Pending>
          <QueryState.Error fallback="Could not load the hosts" />
          <QueryState.Data>
            <Throws />
          </QueryState.Data>
        </QueryState>
      </OppenheimerProvider>,
    );

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(capture).toHaveBeenCalledWith(broken, { tags: { boundary: 'query-state' } });
  });
});
