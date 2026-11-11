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
 * cached marks, so the rows leave together on the click, and a refusal from
 * the API for any of them puts the list back and reads it again rather than
 * leaving rows gone that the server never marked.
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
  it('marks every selected occurrence, replacing what each had', async () => {
    const putMark = vi.fn(
      async (itemKey: string, mark: 'done') => new InboxMarkEntity(itemKey, mark, null, new Date()),
    );
    const { result, marks } = setup({ putMark, findMarks: vi.fn() });

    act(() => result.current.mutate({ itemKeys: ['a', 'b'], mark: 'done' }));
    expect(marks()).toEqual(['a:done', 'b:done']);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(putMark).toHaveBeenCalledTimes(2);
    expect(marks()).toEqual(['a:done', 'b:done']);
  });

  it('clears each mark when restoring priority', async () => {
    const deleteMark = vi.fn().mockResolvedValue(undefined);
    const { result, marks } = setup({ deleteMark, findMarks: vi.fn() });

    act(() => result.current.mutate({ itemKeys: ['a'], mark: null }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteMark).toHaveBeenCalledWith('a');
    expect(marks()).toEqual([]);
  });

  it('puts the list back and reads it again when the API refuses one of them', async () => {
    const putMark = vi.fn(async (itemKey: string) => {
      if (itemKey === 'b') throw new Error('refused');
      return new InboxMarkEntity(itemKey, 'deleted', null, new Date());
    });
    const findMarks = vi.fn().mockResolvedValue([lowA]);
    const { result, marks } = setup({ putMark, findMarks });

    act(() => result.current.mutate({ itemKeys: ['a', 'b'], mark: 'deleted' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(marks()).toEqual(['a:low']);
  });
});
