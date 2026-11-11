import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { useInboxCount, useInboxPullsShown } from '../inbox.queries';
import { fakeKernel } from './fake-kernel';

/**
 * The agents open their pull requests under the reader's account, so every
 * one of them sat in the Inbox as the reader's to merge, and buried what
 * actually needed them. Pull requests are listed only once the reader turns
 * them on, and until then they are not even read.
 */

const ready = {
  scope: 'mine',
  blocker: null,
  githubRepoId: 7,
  number: 802,
  headSha: 'abc',
  openedAt: new Date('2026-11-10T10:00:00Z'),
};
const NOW = Date.parse('2026-11-10T12:00:00Z');

function setup() {
  const queue = vi.fn(async (scope: string) => ({
    items: scope === 'mine' ? [ready] : [],
    filling: false,
  }));
  const app = fakeKernel({
    [TOKENS.SessionsService]: { findAll: vi.fn().mockResolvedValue([]) },
    [TOKENS.BotsRepository]: {
      findWorkspacePendingApprovals: vi.fn().mockResolvedValue([]),
      findWorkspaceNotices: vi.fn().mockResolvedValue([]),
    },
    [TOKENS.AutomationsRepository]: { findRuns: vi.fn().mockResolvedValue({ items: [] }) },
    [TOKENS.InboxRepository]: {
      findMarks: vi.fn().mockResolvedValue([]),
      findReports: vi.fn().mockResolvedValue([]),
    },
    [TOKENS.ProjectsRepository]: { findAll: vi.fn().mockResolvedValue([]) },
    [TOKENS.PullRequestsRepository]: { queue },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  const hook = renderHook(() => ({ count: useInboxCount(NOW), pulls: useInboxPullsShown() }), {
    wrapper,
  });
  return { ...hook, queue };
}

describe('the Inbox and pull requests', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('leaves a pull request ready to merge out, and never reads the queue, until shown', async () => {
    const { result, queue } = setup();
    await waitFor(() => expect(result.current.count).toBe(0));
    expect(queue).not.toHaveBeenCalled();
    expect(result.current.pulls[0]).toBe(false);
  });

  it('counts it once the reader shows pull requests, and remembers the choice', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.count).toBe(0));

    act(() => result.current.pulls[1](true));
    await waitFor(() => expect(result.current.count).toBe(1));
    expect(localStorage.getItem('oppenheimer.inbox.pulls')).toBe('true');

    act(() => result.current.pulls[1](false));
    await waitFor(() => expect(result.current.count).toBe(0));
  });
});
