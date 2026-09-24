import type { UseMutationResult } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { HostEntity } from '../../modules/hosts';
import * as entry from '../index';
import { exported, invalidated, setup } from './_eval-harness';

type Rename = (options?: {
  onSuccess?: (...args: unknown[]) => unknown;
}) => UseMutationResult<HostEntity, Error, { id: string; name: string }>;

const host = (name: string) =>
  new HostEntity('host-1', name, true, 'box', 'linux', null, null, null, new Date(0));

function arrange() {
  const service = {
    rename: vi.fn(async (_id: string, name: string) => host(name)),
    findAll: vi.fn(async () => [host('Renamed')]),
    pair: vi.fn(async () => {
      throw new Error('a pairing token was minted');
    }),
    pairings: vi.fn(async () => []),
  };
  const { queryClient, wrapper } = setup({ [TOKENS.HostsService]: service });
  const keys = entry.hostsKeys;
  queryClient.setQueryData(keys.list(), [host('Old box')]);
  queryClient.setQueryData(keys.pairingDetail('laptop'), { id: 'token-1' });
  queryClient.setQueryData(keys.pairingList(), []);
  queryClient.setQueryData(['sessions', 'list'], []);
  return { service, queryClient, wrapper, keys };
}

async function rename(onSuccess = vi.fn()) {
  const arranged = arrange();
  const useRenameHost = exported<Rename>(entry, 'useRenameHost');
  const { result } = renderHook(() => useRenameHost({ onSuccess }), {
    wrapper: arranged.wrapper,
  });
  act(() => result.current.mutate({ id: 'host-1', name: 'Renamed' }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return { ...arranged, onSuccess };
}

describe('host-rename', () => {
  it('exports useRenameHost from the react entry', () => {
    expect(typeof exported(entry, 'useRenameHost')).toBe('function');
  });

  it("runs a caller's onSuccess alongside the hook's cache update, not instead of it", async () => {
    const { onSuccess, queryClient, keys } = await rename();
    expect(onSuccess).toHaveBeenCalled();
    const list = queryClient.getQueryData<HostEntity[]>(keys.list());
    const listFresh = list?.some((row) => row.name === 'Renamed') ?? false;
    expect(listFresh || invalidated(queryClient, keys.list())).toBe(true);
  });

  it('leaves the pairing flow alone: refreshing a pairing detail would mint a token', async () => {
    const { queryClient, keys, service } = await rename();
    expect(invalidated(queryClient, keys.pairingDetail('laptop'))).toBe(false);
    expect(queryClient.getQueryData(keys.pairingDetail('laptop'))).toBeDefined();
    expect(service.pair).not.toHaveBeenCalled();
  });

  it("invalidates the narrowest keys, not the root or another feature's cache", async () => {
    const { queryClient } = await rename();
    expect(invalidated(queryClient, ['sessions', 'list'])).toBe(false);
    const everyHostKeyStale = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['hosts'] })
      .every((query) => query.state.isInvalidated);
    expect(everyHostKeyStale).toBe(false);
  });
});
