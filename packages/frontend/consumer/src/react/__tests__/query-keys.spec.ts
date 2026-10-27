import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { botsKeys } from '../bots.queries';
import { calendarKeys } from '../calendar.queries';
import { cloudAgentsKeys } from '../cloud-agents.queries';
import { hostsKeys } from '../hosts.queries';
import { installationsKeys } from '../installations.queries';
import { pullRequestsKeys } from '../pull-requests.queries';
import { sessionsKeys } from '../sessions.queries';
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

  /** A host's folders are read through its runner: a presence poll must not ask it again. */
  it('keeps a host’s folders out of the host list, and one host’s from another’s', async () => {
    const home = hostsKeys.folders('h-1', null);
    const theirs = hostsKeys.folders('h-2', null);
    const client = cacheWith(hostsKeys.list(), home, hostsKeys.folders('h-1', '/srv'), theirs);

    await client.invalidateQueries({ queryKey: hostsKeys.lists() });
    expect(invalidated(client, home)).toBe(false);

    await client.invalidateQueries({ queryKey: hostsKeys.folderLists('h-1') });
    expect(invalidated(client, home)).toBe(true);
    expect(invalidated(client, hostsKeys.folders('h-1', '/srv'))).toBe(true);
    expect(invalidated(client, theirs)).toBe(false);
  });
});

describe('tasksKeys', () => {
  it('refreshes the board without touching the milestones', async () => {
    const board = tasksKeys.list();
    const milestones = tasksKeys.milestoneList();
    const client = cacheWith(board, milestones);

    await client.invalidateQueries({ queryKey: tasksKeys.lists() });

    expect(invalidated(client, board)).toBe(true);
    expect(invalidated(client, milestones)).toBe(false);
  });
});

describe('sessionsKeys', () => {
  it('refreshes a session’s row and start log without reading its share again', async () => {
    const start = sessionsKeys.start('s-1', false);
    const share = sessionsKeys.share('s-1');
    const client = cacheWith(sessionsKeys.detail('s-1'), start, share);

    await client.invalidateQueries({ queryKey: sessionsKeys.detail('s-1') });

    expect(invalidated(client, sessionsKeys.detail('s-1'))).toBe(true);
    expect(invalidated(client, start)).toBe(true);
    expect(invalidated(client, share)).toBe(false);
  });
});

describe('pullRequestsKeys', () => {
  const address = { installationId: 'inst-1', githubRepoId: 42, number: 7 };

  it('refreshes one pull request’s files with it, and no other’s', async () => {
    const files = pullRequestsKeys.files(address);
    const other = pullRequestsKeys.files({ ...address, number: 8 });
    const client = cacheWith(files, other);

    await client.invalidateQueries({ queryKey: pullRequestsKeys.detail(address) });

    expect(invalidated(client, files)).toBe(true);
    expect(invalidated(client, other)).toBe(false);
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

describe('botsKeys', () => {
  it('drops a deleted bot’s documents, revisions and memory with it, and nobody else’s', () => {
    const mine = [
      botsKeys.detail('bot-1'),
      botsKeys.documentList('bot-1'),
      botsKeys.revisions('bot-1', 'instructions'),
      botsKeys.memoryList('bot-1'),
    ];
    const theirs = botsKeys.memoryList('bot-2');
    const client = cacheWith(...mine, theirs, botsKeys.list());

    client.removeQueries({ queryKey: botsKeys.detail('bot-1') });

    for (const key of mine) expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(theirs)).toBe('cached');
    expect(client.getQueryData(botsKeys.list())).toBe('cached');
  });

  it('refreshes one document’s history without refetching the other’s or the pair', async () => {
    const instructions = botsKeys.revisions('bot-1', 'instructions');
    const soul = botsKeys.revisions('bot-1', 'soul');
    const client = cacheWith(instructions, soul, botsKeys.documentList('bot-1'));

    await client.invalidateQueries({ queryKey: instructions });

    expect(invalidated(client, instructions)).toBe(true);
    expect(invalidated(client, soul)).toBe(false);
    expect(invalidated(client, botsKeys.documentList('bot-1'))).toBe(false);
  });

  it('re-reads the sidebar’s bots without touching its groups', async () => {
    const client = cacheWith(botsKeys.list(), botsKeys.groupList(), botsKeys.detail('bot-1'));

    await client.invalidateQueries({ queryKey: botsKeys.lists() });

    expect(invalidated(client, botsKeys.list())).toBe(true);
    expect(invalidated(client, botsKeys.groupList())).toBe(false);
    expect(invalidated(client, botsKeys.detail('bot-1'))).toBe(false);
  });
});

describe('cloudAgentsKeys', () => {
  it('reads the list again after a launch without dropping the open agent', async () => {
    const list = cloudAgentsKeys.list();
    const detail = cloudAgentsKeys.detail('agent-1');
    const client = cacheWith(list, detail, cloudAgentsKeys.status());

    await client.invalidateQueries({ queryKey: cloudAgentsKeys.lists() });

    expect(invalidated(client, list)).toBe(true);
    expect(invalidated(client, detail)).toBe(false);
    expect(invalidated(client, cloudAgentsKeys.status())).toBe(false);
  });

  it('reads a vendor’s models and repositories again on a new key, and nothing else', async () => {
    const models = cloudAgentsKeys.models('cursor');
    const repositories = cloudAgentsKeys.repositories('cursor');
    const client = cacheWith(models, repositories, cloudAgentsKeys.list());

    await client.invalidateQueries({ queryKey: cloudAgentsKeys.providers() });

    expect(invalidated(client, models)).toBe(true);
    expect(invalidated(client, repositories)).toBe(true);
    expect(invalidated(client, cloudAgentsKeys.list())).toBe(false);
  });
});
