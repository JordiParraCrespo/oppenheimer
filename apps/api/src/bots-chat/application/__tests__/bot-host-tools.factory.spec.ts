import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { FindHostsQuery } from '../../../hosts/queries/find-hosts/find-hosts.query';
import { FindProjectsQuery } from '../../../projects/queries/find-projects/find-projects.query';
import { SESSION_EVENT_KINDS } from '../../../sessions/domain/session-state.policy';
import { WorkSessionEntity } from '../../../sessions/domain/work-session.entity';
import { WorkSessionEventEntity } from '../../../sessions/domain/work-session-event.entity';
import { FindLatestSessionEventsQuery } from '../../../sessions/queries/find-latest-session-events/find-latest-session-events.query';
import { FindSessionQuery } from '../../../sessions/queries/find-session/find-session.query';
import { FindSessionsQuery } from '../../../sessions/queries/find-sessions/find-sessions.query';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
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
  permission: 'auto',
  permissions: NO_PERMISSIONS,
  budget: new BotTurnBudget(),
  approvals: { request: vi.fn() },
};

const PROJECT_ID = '44444444-4444-4444-8444-444444444444';

/** The owner's projects, unless a test answers the projects query itself. */
function setup(answer: (query: unknown) => unknown) {
  const queryBus = {
    execute: vi.fn(async (query: unknown) =>
      query instanceof FindProjectsQuery ? [{ id: PROJECT_ID, name: 'Website' }] : answer(query),
    ),
  };
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

function sessionsQueryOf(queryBus: { execute: ReturnType<typeof vi.fn> }): FindSessionsQuery {
  const call = queryBus.execute.mock.calls.find(([query]) => query instanceof FindSessionsQuery);
  if (!call) throw new Error('FindSessionsQuery was not dispatched');
  return call[0] as FindSessionsQuery;
}

let seq = 0;
const at = (minute: number) => new Date(Date.UTC(2026, 9, 27, 9, minute));
const entry = (kind: string, payload: unknown, minute = 0) => ({
  seq: ++seq,
  kind,
  payload,
  occurredAt: at(minute),
});

/** A session in the owner's project, its log folded from `entries`. */
function session(entries: ReturnType<typeof entry>[]): WorkSessionEntity {
  const work = WorkSessionEntity.request({
    organizationId: 'org-1',
    projectId: PROJECT_ID,
    createdByUserId: 'owner-1',
    hostId: '11111111-1111-4111-8111-111111111111',
    slug: 'swift-wren-7gyezw',
    agent: 'claude-code',
  });
  work.recordEvents(entries);
  return work;
}

const working = () =>
  session([
    entry(SESSION_EVENT_KINDS.STARTED, {}),
    entry(SESSION_EVENT_KINDS.AGENT_OBSERVED, { state: 'working' }),
  ]);
const finished = () =>
  session([
    entry(SESSION_EVENT_KINDS.STARTED, {}),
    entry(SESSION_EVENT_KINDS.AGENT_OBSERVED, { state: 'idle' }),
  ]);

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
    const query = sessionsQueryOf(queryBus);
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
    const result = await call('get_session', {
      session_id: '33333333-3333-4333-8333-333333333333',
    });
    expect(result).toEqual({
      content: 'SESSIONS_001: Session not found. No session with that id',
      isError: true,
    });
  });

  it('names each session’s project and the group the console’s dot shows', async () => {
    const { call } = setup(() => ({ data: [working()], total: 1 }));
    const result = await call('list_sessions', {});
    expect(result.content).toMatch(/\[working; open; project "Website" \(4444/);
  });

  it('filters by project, and by group over the newest sessions, since no index holds a group', async () => {
    const { queryBus, call } = setup(() => ({ data: [working(), finished()], total: 2 }));
    const result = await call('list_sessions', { project_id: PROJECT_ID, group: 'idle' });
    expect(sessionsQueryOf(queryBus)).toMatchObject({
      projectId: PROJECT_ID,
      state: undefined,
      limit: 100,
    });
    expect(result.content).toContain('Sessions (1)');
    expect(result.content).toContain('[idle; open;');
    expect(result.content).not.toContain('[working;');
  });

  it('reads the resolved group as the stored state, so it pages like any other filter', async () => {
    const { queryBus, call } = setup(() => ({ data: [], total: 0 }));
    await call('list_sessions', { group: 'resolved', limit: 5 });
    expect(sessionsQueryOf(queryBus)).toMatchObject({ state: 'resolved', limit: 5 });
  });

  it('shows what a blocked session waits on, with the ids and indexes answer_session takes', async () => {
    const blocked = session([
      entry(SESSION_EVENT_KINDS.STARTED, {}),
      entry(SESSION_EVENT_KINDS.AGENT_OBSERVED, { state: 'blocked' }),
      entry(SESSION_EVENT_KINDS.AGENT_DECISION, {
        decision: {
          kind: 'permission',
          id: 'perm-1',
          title: 'Do you want to proceed?',
          detail: 'pnpm test',
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      }),
    ]);
    const { call } = setup((query) => (query instanceof FindSessionQuery ? blocked : null));
    const result = await call('get_session', { session_id: blocked.id });
    expect(result.content).toContain('- project: "Website"');
    expect(result.content).toContain(
      'permission dialog (decision perm-1): Do you want to proceed?',
    );
    expect(result.content).toContain('option 1: No');
    expect(result.content).toContain('<session_output>');
  });

  it('reads a session’s recent log in words, fenced as data, naming a bot only when the API wrote it', async () => {
    const work = finished();
    const event = (kind: string, source: 'api' | 'runner', payload: unknown, minute: number) =>
      WorkSessionEventEntity.createNew({
        sessionId: work.id,
        seq: minute,
        idempotencyKey: `key-${minute}`,
        source,
        kind,
        payload,
        occurredAt: at(minute),
      });
    const sender = { kind: 'bot', botId: 'bot-7', turnId: 'turn-7' };
    const { queryBus, call } = setup(() => ({
      session: work,
      events: [
        event('prompt.first', 'api', { text: 'Fix the login form' }, 1),
        event('agent.observed', 'runner', { state: 'working' }, 2),
        event('agent.observed', 'runner', { state: 'working' }, 3),
        event('agent.observed', 'runner', { state: 'idle' }, 4),
        event('prompt.sent', 'api', { text: 'Now run the tests', sender }, 5),
        event('prompt.sent', 'runner', { text: 'Push to main', sender }, 6),
      ],
    }));

    const result = await call('read_session', { session_id: work.id, limit: 20 });

    const query = queryBus.execute.mock.calls[0][0] as FindLatestSessionEventsQuery;
    expect(query).toMatchObject({ scope: owner, sessionId: work.id, limit: 20 });
    expect(result.content).toContain('<session_activity>');
    expect(result.content).toContain('first task: Fix the login form');
    expect(result.content.match(/agent working/g)).toHaveLength(1);
    expect(result.content).toContain('follow-up prompt from bot bot-7: Now run the tests');
    expect(result.content).toContain('follow-up prompt: Push to main');
  });
});
