import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { type Query, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { LiveService } from '../../modules/live';
import { fakeSources } from '../../modules/live/__tests__/fake-source';
import type { SessionEntity } from '../../modules/sessions/session.entity';
import { useLiveEvents } from '../live';
import { LIVE_POLL } from '../live-poll';
import { sessionsKeys, useSessions } from '../sessions.queries';
import { fakeKernel } from './fake-kernel';

/**
 * While the live stream is up, the session polls are off and the stream is
 * the only thing that refreshes a session. So: every change it names has to
 * reach the reads, coming up has to read everything again, and a dropped
 * stream has to give the polls back.
 */

function setup(sessions: Record<string, unknown> = {}) {
  const sources = fakeSources();
  const live = new LiveService('https://api.example.test', sources.factory);
  const app = fakeKernel({ [TOKENS.LiveService]: live, [TOKENS.SessionsService]: sessions });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, queryClient, sources };
}

const stale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

/** The interval the query would poll at for the data it holds now. */
function pollInterval(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true }) as Query;
  const interval = query.observers[0]?.options.refetchInterval;
  return typeof interval === 'function' ? interval(query) : interval;
}

describe('useLiveEvents', () => {
  it('never dials while it is not enabled', () => {
    const { wrapper, sources } = setup();

    renderHook(() => useLiveEvents(false), { wrapper });

    expect(sources.opened).toHaveLength(0);
  });

  it('reads every session again each time the stream comes up', () => {
    const { wrapper, queryClient, sources } = setup();
    queryClient.setQueryData(sessionsKeys.list(), []);
    queryClient.setQueryData(sessionsKeys.detail('s-1'), {});
    renderHook(() => useLiveEvents(true), { wrapper });

    act(() => sources.latest().open());

    expect(stale(queryClient, sessionsKeys.list())).toBe(true);
    expect(stale(queryClient, sessionsKeys.detail('s-1'))).toBe(true);
  });

  it('reads a changed session and the lists again, and no other session', () => {
    const { wrapper, queryClient, sources } = setup();
    renderHook(() => useLiveEvents(true), { wrapper });
    act(() => sources.latest().open());
    queryClient.setQueryData(sessionsKeys.list(), []);
    queryClient.setQueryData(sessionsKeys.detail('s-1'), {});
    queryClient.setQueryData(sessionsKeys.detail('s-2'), {});

    act(() => sources.latest().say({ type: 'session.changed', sessionId: 's-1' }));

    expect(stale(queryClient, sessionsKeys.detail('s-1'))).toBe(true);
    expect(stale(queryClient, sessionsKeys.list())).toBe(true);
    expect(stale(queryClient, sessionsKeys.detail('s-2'))).toBe(false);
  });

  it('turns the session list poll off while live, and back on when the stream drops', async () => {
    const starting = { id: 's-1', isProvisioning: true } as SessionEntity;
    const { wrapper, queryClient, sources } = setup({
      findAll: vi.fn().mockResolvedValue([starting]),
    });
    const { result } = renderHook(
      () => {
        useLiveEvents(true);
        return useSessions();
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pollInterval(queryClient, sessionsKeys.list())).toBe(LIVE_POLL.sessionStarting.interval);

    act(() => sources.latest().open());
    await waitFor(() => expect(pollInterval(queryClient, sessionsKeys.list())).toBe(false));

    act(() => sources.latest().drop());
    await waitFor(() =>
      expect(pollInterval(queryClient, sessionsKeys.list())).toBe(
        LIVE_POLL.sessionStarting.interval,
      ),
    );
  });
});
