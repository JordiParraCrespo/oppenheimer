import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { ReviewSession } from '../../modules/pull-requests/pull-request.entity';
import type { SessionEntity } from '../../modules/sessions/session.entity';
import { useCloseReviewSession, useReviewSessions } from '../pull-requests.queries';
import { fakeKernel } from './fake-kernel';

/**
 * Deleting a review session is the sessions' close, and For review had no way
 * to ask for it. The row leaves the list on the click; a close the API
 * refuses puts it back.
 */

const review = { sessionId: 'r-1', number: 292 } as ReviewSession;

function setup(reviewSessions: ReturnType<typeof vi.fn>, close: ReturnType<typeof vi.fn>) {
  const app = fakeKernel({
    [TOKENS.PullRequestsRepository]: { reviewSessions },
    [TOKENS.SessionsService]: { close },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return renderHook(() => ({ list: useReviewSessions(), close: useCloseReviewSession() }), {
    wrapper,
  });
}

describe('useCloseReviewSession', () => {
  it('closes the session and leaves For review on the click', async () => {
    const close = vi.fn(() => new Promise<SessionEntity>(() => {}));
    const { result } = setup(vi.fn().mockResolvedValue([review]), close);
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    result.current.close.mutate({ sessionId: 'r-1', acceptUnpushedWork: true });
    await waitFor(() => expect(result.current.list.data).toEqual([]));
    expect(close).toHaveBeenCalledWith('r-1', true);
  });

  it('comes back when the close is refused', async () => {
    const reviewSessions = vi.fn().mockResolvedValue([review]);
    const { result } = setup(reviewSessions, vi.fn().mockRejectedValue(new Error('refused')));
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    result.current.close.mutate({ sessionId: 'r-1' });
    await waitFor(() => expect(result.current.close.isError).toBe(true));
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
  });
});
