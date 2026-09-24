import type { UseQueryResult } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import * as entry from '../index';
import {
  cachedKeys,
  exported,
  factoryFor,
  invalidated,
  same,
  setup,
  startsWith,
} from './_eval-harness';

type Page = { afterSeq?: number; limit?: number };
type UseSessionEvents = (id: string | undefined, page?: Page) => UseQueryResult<unknown>;

const PAGE: Page = { afterSeq: 5, limit: 50 };

function arrange() {
  const service = { events: vi.fn(async () => ({ events: [], nextSeq: null })) };
  return { service, ...setup({ [TOKENS.SessionsService]: service }) };
}

async function readPage(id: string | undefined, page: Page = PAGE) {
  const arranged = arrange();
  const useSessionEvents = exported<UseSessionEvents>(entry, 'useSessionEvents');
  const { result } = renderHook(() => useSessionEvents(id, page), { wrapper: arranged.wrapper });
  if (id) await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const [key] = cachedKeys(arranged.queryClient);
  return { ...arranged, key: key ?? [], result };
}

describe('session-events', () => {
  it('exports useSessionEvents from the react entry', () => {
    expect(typeof exported(entry, 'useSessionEvents')).toBe('function');
  });

  it('holds the read off while the session id is unknown, without a placeholder id', async () => {
    const { service, queryClient } = await readPage(undefined);
    expect(service.events).not.toHaveBeenCalled();
    const keys = JSON.stringify(cachedKeys(queryClient));
    expect(keys).not.toContain('""');
    expect(keys).not.toMatch(/,0[,\]]/);
  });

  it('reads the page it was asked for', async () => {
    const { service } = await readPage('session-1');
    expect(service.events).toHaveBeenCalledWith('session-1', expect.objectContaining(PAGE));
  });

  it('keys the page with a function of sessionsKeys, not a hand-written array', async () => {
    const { key } = await readPage('session-1');
    expect(factoryFor(entry.sessionsKeys, key, ['session-1', PAGE])).toBeDefined();
  });

  it("nests the log under the session's detail, so refreshing the session reaches it", async () => {
    const { key, queryClient } = await readPage('session-1');
    expect(startsWith(key, entry.sessionsKeys.detail('session-1'))).toBe(true);
    // `refetchType: 'none'`: an active query would refetch at once and clear the flag.
    await queryClient.invalidateQueries({
      queryKey: entry.sessionsKeys.detail('session-1'),
      refetchType: 'none',
    });
    expect(invalidated(queryClient, key)).toBe(true);
  });

  it('gives the log its own level between the session and the page', async () => {
    const { key } = await readPage('session-1');
    const detail = entry.sessionsKeys.detail('session-1');
    const scope = Object.values(entry.sessionsKeys).find((level) => {
      if (typeof level !== 'function') return false;
      try {
        const candidate = level('session-1') as readonly unknown[];
        return (
          candidate.length > detail.length &&
          candidate.length < key.length &&
          startsWith(key, candidate)
        );
      } catch {
        return false;
      }
    });
    expect(scope).toBeDefined();
  });

  it('puts the page parameters in the key as one object, so pages are separate entries', async () => {
    const { key } = await readPage('session-1');
    const last = key[key.length - 1];
    expect(typeof last === 'object' && last !== null && !Array.isArray(last)).toBe(true);
    const other = await readPage('session-1', { afterSeq: 9, limit: 50 });
    expect(same(key, other.key)).toBe(false);
  });

  it('stays out of the session list: refreshing the list does not refetch a log', async () => {
    const { key, queryClient } = await readPage('session-1');
    await queryClient.invalidateQueries({
      queryKey: entry.sessionsKeys.lists(),
      refetchType: 'none',
    });
    expect(invalidated(queryClient, key)).toBe(false);
  });
});
