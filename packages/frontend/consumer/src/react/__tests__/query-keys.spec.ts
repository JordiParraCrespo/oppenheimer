import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { hostsKeys } from '../hosts.queries';
import { installationsKeys } from '../installations.queries';

/**
 * The key shapes, and what invalidating one of them reaches. Reach is asked of
 * a real `QueryClient`, so the answer is React Query's own matcher.
 */

function cacheWith(...keys: (readonly unknown[])[]) {
  const client = new QueryClient();
  for (const key of keys) client.setQueryData(key, 'cached');
  return client;
}

const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false;

describe('installationsKeys', () => {
  it('gives repositories the full ladder, one function per level', () => {
    expect(installationsKeys.repositoryLists('inst-1')).toEqual(
      installationsKeys.repositoryList('inst-1'),
    );
    expect(installationsKeys.repositoryDetails('inst-1')).toEqual([
      'installations',
      'detail',
      'inst-1',
      'repositories',
      'detail',
    ]);
    expect(installationsKeys.repositoryDetail('inst-1', 42)).toEqual([
      ...installationsKeys.repositoryDetails('inst-1'),
      42,
    ]);
  });

  it('splits repositories into a list and per-repository details', () => {
    expect(installationsKeys.repositoryList('inst-1')).toEqual([
      'installations',
      'detail',
      'inst-1',
      'repositories',
      'list',
    ]);
    expect(installationsKeys.branches('inst-1', 42)).toEqual([
      'installations',
      'detail',
      'inst-1',
      'repositories',
      'detail',
      42,
      'branches',
    ]);
  });

  it('keeps an id nobody chose as undefined rather than a made-up one', () => {
    expect(installationsKeys.repositoryList(undefined)).toContain(undefined);
    expect(installationsKeys.branches('inst-1', undefined)).toContain(undefined);
  });

  it('refreshes a repository list without refetching every branch under it', async () => {
    const list = installationsKeys.repositoryList('inst-1');
    const branches = installationsKeys.branches('inst-1', 42);
    const client = cacheWith(list, branches);

    await client.invalidateQueries({ queryKey: list });

    expect(invalidated(client, list)).toBe(true);
    expect(invalidated(client, branches)).toBe(false);
  });

  it('drops one installation’s whole subtree and nothing else', () => {
    const mine = installationsKeys.branches('inst-1', 42);
    const theirs = installationsKeys.branches('inst-2', 42);
    const client = cacheWith(installationsKeys.repositoryList('inst-1'), mine, theirs);

    client.removeQueries({ queryKey: installationsKeys.detail('inst-1') });

    expect(client.getQueryData(installationsKeys.repositoryList('inst-1'))).toBeUndefined();
    expect(client.getQueryData(mine)).toBeUndefined();
    expect(client.getQueryData(theirs)).toBe('cached');
  });
});

describe('hostsKeys', () => {
  it('gives pairing the full ladder, one function per level', () => {
    expect(hostsKeys.pairings()).toEqual(['hosts', 'pairing']);
    expect(hostsKeys.pairingLists()).toEqual(['hosts', 'pairing', 'list']);
    expect(hostsKeys.pairingList()).toEqual(['hosts', 'pairing', 'list']);
    expect(hostsKeys.pairingDetails()).toEqual(['hosts', 'pairing', 'detail']);
    expect(hostsKeys.pairingDetail('laptop')).toEqual(['hosts', 'pairing', 'detail', 'laptop']);
  });

  it('refreshes the token poll without minting a new token', async () => {
    const client = cacheWith(hostsKeys.pairingList(), hostsKeys.pairingDetail('laptop'));

    await client.invalidateQueries({ queryKey: hostsKeys.pairingLists() });

    expect(invalidated(client, hostsKeys.pairingList())).toBe(true);
    expect(invalidated(client, hostsKeys.pairingDetail('laptop'))).toBe(false);
  });

  it('keeps pairing out of the host list', async () => {
    const client = cacheWith(hostsKeys.list(), hostsKeys.pairingList());

    await client.invalidateQueries({ queryKey: hostsKeys.lists() });

    expect(invalidated(client, hostsKeys.list())).toBe(true);
    expect(invalidated(client, hostsKeys.pairingList())).toBe(false);
  });
});
