import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { calendarKeys } from '../calendar.queries';
import { hostsKeys } from '../hosts.queries';
import { installationsKeys } from '../installations.queries';
import { tasksKeys } from '../tasks.queries';

/**
 * What invalidating or removing a key reaches, asked of a real `QueryClient`,
 * so the answer is React Query's own matcher rather than a key's spelling; and
 * that an id nobody chose stays `undefined`, since the hook gates on it.
 */

function cacheWith(...keys: (readonly unknown[])[]) {
  const client = new QueryClient();
  for (const key of keys) client.setQueryData(key, 'cached');
  return client;
}

const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false;

describe('installationsKeys', () => {
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

describe('tasksKeys', () => {
  it('refreshes every task list, the board and a session’s alike, without touching the goals', async () => {
    const board = tasksKeys.list({});
    const session = tasksKeys.list({ sessionId: 's-1' });
    const goals = tasksKeys.goalList();
    const client = cacheWith(board, session, goals);

    await client.invalidateQueries({ queryKey: tasksKeys.lists() });

    expect(invalidated(client, board)).toBe(true);
    expect(invalidated(client, session)).toBe(true);
    expect(invalidated(client, goals)).toBe(false);
  });
});

describe('calendarKeys', () => {
  it('refreshes the workspace’s events without reading Google again', async () => {
    const october = calendarKeys.eventRange({ from: '2026-10-01', to: '2026-10-31' });
    const google = calendarKeys.googleEvents(
      { from: '2026-10-01', to: '2026-10-31' },
      'Europe/Madrid',
    );
    const client = cacheWith(october, google);

    await client.invalidateQueries({ queryKey: calendarKeys.events() });

    expect(invalidated(client, october)).toBe(true);
    expect(invalidated(client, google)).toBe(false);
  });
});
