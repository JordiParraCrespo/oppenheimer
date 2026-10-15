import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { FindHostsQuery } from '../../../hosts/queries/find-hosts/find-hosts.query';
import { FindSessionsQuery } from '../../../sessions/queries/find-sessions/find-sessions.query';
import { BotHostToolsFactory } from '../bot-host-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * The host and session tools a bot reads through: each dispatches the
 * hosts' or sessions' own query in the owner's scope, and answers labelled
 * text the model can quote, with "none" said in words. Bad input and a
 * catalog error come back as error results the model can act on, never as
 * a thrown turn. The queries themselves are their modules' specs.
 */
const owner = emptyScope('owner-1', 'org-1');
const context: BotToolContext = {
  owner,
  organizationId: 'org-1',
  botId: 'bot-1',
  turnId: 'turn-1',
  homeHostId: '11111111-1111-4111-8111-111111111111',
  timeZone: 'Europe/Madrid',
};

function setup(answer: (query: unknown) => unknown) {
  const queryBus = { execute: vi.fn(async (query: unknown) => answer(query)) };
  const factory = new BotHostToolsFactory(queryBus as unknown as QueryBus);
  const tool = (name: string) => {
    const found = factory.definitions().find((definition) => definition.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found.bind(context);
  };
  const call = (name: string, input: unknown) =>
    tool(name).run(input, { signal: new AbortController().signal });
  return { queryBus, call };
}

const host = (id: string, name: string, online: boolean) => ({
  host: { id, name },
  online,
  runningSessions: online ? 2 : 0,
  inventory: {
    osName: 'Ubuntu 24.04',
    platform: 'linux',
    tools: [
      { name: 'claude', path: '/usr/bin/claude', required: false },
      { name: 'codex', required: false },
    ],
  },
  vitals: { lastSeenAt: new Date('2026-10-15T08:00:00Z') },
});

describe('BotHostToolsFactory', () => {
  it('lists the owner’s hosts, marking the home host, with the agents each can start', async () => {
    const { queryBus, call } = setup(() => [
      host('11111111-1111-4111-8111-111111111111', 'build-01', true),
      host('22222222-2222-4222-8222-222222222222', 'old-laptop', false),
    ]);

    const result = await call('list_hosts', {});

    expect(queryBus.execute).toHaveBeenCalledWith(expect.any(FindHostsQuery));
    expect((queryBus.execute.mock.calls[0][0] as FindHostsQuery).scope).toBe(owner);
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain('"build-01" (your home host) [online; 2 running');
    expect(result.content).toContain('agents: Claude Code]');
    expect(result.content).toContain('"old-laptop" [offline, last seen 15 Oct 2026, 10:00');
  });

  it('says in words that there are no hosts, rather than an empty list', async () => {
    const { call } = setup(() => []);
    expect((await call('list_hosts', {})).content).toContain('No hosts are connected');
  });

  it('filters sessions by host and state in the owner’s scope, and says how many were left out', async () => {
    const { queryBus, call } = setup(() => ({ data: [], total: 0 }));
    const result = await call('list_sessions', {
      host_id: '11111111-1111-4111-8111-111111111111',
      state: 'open',
    });
    const query = queryBus.execute.mock.calls[0][0] as FindSessionsQuery;
    expect(query).toBeInstanceOf(FindSessionsQuery);
    expect(query).toMatchObject({
      scope: owner,
      hostId: '11111111-1111-4111-8111-111111111111',
      state: 'open',
      limit: 10,
    });
    expect(result.content).toBe('No sessions match.');
  });

  it('answers bad input as an error the model can correct, dispatching nothing', async () => {
    const { queryBus, call } = setup(() => []);
    const result = await call('list_sessions', { state: 'running', limit: 500 });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/^Invalid input: /);
    expect(result.content).toContain('state');
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('reads a catalog error back as its code, title and detail', async () => {
    const { call } = setup(() => {
      throw new AppError(
        { code: 'SESSIONS_001', message: 'Session not found', httpStatus: 404 },
        { detail: 'No session with that id' },
      );
    });
    const result = await call('get_session', { session_id: '33333333-3333-4333-8333-333333333333' });
    expect(result).toEqual({
      content: 'SESSIONS_001: Session not found. No session with that id',
      isError: true,
    });
  });
});
