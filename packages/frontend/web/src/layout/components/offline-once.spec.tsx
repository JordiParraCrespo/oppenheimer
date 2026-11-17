import { AppError } from '@oppenheimer/frontend-core';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorAlert } from '../../forms';
import { useOfflineOnce } from '../hooks/use-offline-once';
import { OfflineOnce } from './offline-once';
import { QueryState } from './query-state';

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

const offline = () => new TypeError('Failed to fetch');
const refused = () => new AppError({ code: 'SESSIONS_001', message: 'Refused' }, { status: 409 });

function Section({ name, fetch }: { name: string; fetch: () => Promise<string> }) {
  return (
    <QueryState>
      <QueryState.Pending>loading {name}</QueryState.Pending>
      <QueryState.Error fallback={`Could not load the ${name}`} offlineOnce />
      <QueryState.Data>
        <Read name={name} fetch={fetch} />
      </QueryState.Data>
    </QueryState>
  );
}

const sectionKeys = {
  all: ['sections'] as const,
  detail: (name: string) => [...sectionKeys.all, name] as const,
};

function Read({ name, fetch }: { name: string; fetch: () => Promise<string> }) {
  const { data } = useSuspenseQuery({ queryKey: sectionKeys.detail(name), queryFn: fetch });
  return <p>{data}</p>;
}

function Refetched({ error }: { error: unknown }) {
  return <ErrorAlert error={useOfflineOnce(error)} fallback="Could not refresh" />;
}

function show(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('OfflineOnce', () => {
  it('says the server is unreachable once for every section that failed offline', async () => {
    show(
      <OfflineOnce>
        <Section name="bots" fetch={() => Promise.reject(offline())} />
        <Section name="sessions" fetch={() => Promise.reject(offline())} />
      </OfflineOnce>,
    );
    await screen.findByText('errors.unreachable');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('retries every section from its one Try again', async () => {
    const bots = vi.fn().mockRejectedValueOnce(offline()).mockResolvedValue('three bots');
    const sessions = vi.fn().mockRejectedValueOnce(offline()).mockResolvedValue('two sessions');
    show(
      <OfflineOnce>
        <Section name="bots" fetch={bots} />
        <Section name="sessions" fetch={sessions} />
      </OfflineOnce>,
    );
    await screen.findByText('errors.unreachable');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'common.retry' })));
    expect(await screen.findByText('three bots')).toBeTruthy();
    expect(await screen.findByText('two sessions')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes a refetch that failed offline too', () => {
    show(
      <OfflineOnce>
        <Refetched error={offline()} />
        <Refetched error={offline()} />
      </OfflineOnce>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('leaves a failure the server answered in its section', () => {
    show(
      <OfflineOnce>
        <Refetched error={offline()} />
        <Refetched error={refused()} />
      </OfflineOnce>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('changes nothing outside a scope', () => {
    show(
      <>
        <Refetched error={offline()} />
        <Refetched error={offline()} />
      </>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });
});
