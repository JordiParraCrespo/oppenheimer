import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { InboxMarkEntity } from '../../modules/inbox/inbox-mark.entity';
import { inboxKeys } from '../inbox.keys';
import { usePutInboxMarks } from '../inbox.queries';
import { fakeKernel } from './fake-kernel';

/**
 * A bulk action in the Inbox marks every selected row in one write to the
 * cached marks, so the rows leave together on the click, and in one request:
 * one per row hit the API's hundred-a-minute limit on a large Inbox. A
 * refusal puts the list back rather than leaving rows gone that the server
 * never marked.
 */

const lowA = new InboxMarkEntity('a', 'low', null, new Date('2026-11-10T10:00:00Z'));

function setup(inbox: Record<string, unknown>) {
  const app = fakeKernel({ [TOKENS.InboxRepository]: inbox });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(inboxKeys.marks(), [lowA]);
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  const hook = renderHook(() => usePutInboxMarks(), { wrapper });
  const marks = () =>
    (queryClient.getQueryData<InboxMarkEntity[]>(inboxKeys.marks()) ?? [])
      .map((mark) => `${mark.itemKey}:${mark.mark}`)
      .sort();
  return { ...hook, marks };
}

describe('marking a selection in the Inbox', () => {
  it('marks every selected occurrence in one request, and keeps what the server answers', async () => {
    const answer = [
      new InboxMarkEntity('a', 'done', null, new Date()),
      new InboxMarkEntity('b', 'done', null, new Date()),
    ];
    let settle: (marks: InboxMarkEntity[]) => void = () => {};
    const putMarks = vi.fn(
      () =>
        new Promise<InboxMarkEntity[]>((resolve) => {
          settle = resolve;
        }),
    );
    const { result, marks } = setup({ putMarks });

    act(() => result.current.mutate({ itemKeys: ['a', 'b'], mark: 'done' }));
    await waitFor(() => expect(marks()).toEqual(['a:done', 'b:done']));
    expect(putMarks).toHaveBeenCalledTimes(1);
    expect(putMarks).toHaveBeenCalledWith(['a', 'b'], 'done', undefined);

    act(() => settle(answer));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(marks()).toEqual(['a:done', 'b:done']);
  });

  it('clears each mark on the click when restoring priority', async () => {
    const putMarks = vi.fn().mockResolvedValue([]);
    const { result, marks } = setup({ putMarks });

    act(() => result.current.mutate({ itemKeys: ['a'], mark: null }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(putMarks).toHaveBeenCalledWith(['a'], null, undefined);
    expect(marks()).toEqual([]);
  });

  it('puts the list back when the API refuses the selection', async () => {
    const putMarks = vi.fn().mockRejectedValue(new Error('refused'));
    const findMarks = vi.fn().mockResolvedValue([lowA]);
    const { result, marks } = setup({ putMarks, findMarks });

    act(() => result.current.mutate({ itemKeys: ['a', 'b'], mark: 'deleted' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(marks()).toEqual(['a:low']);
  });
});
