import { emptyScope } from '@oppenheimer/backend-authz';
import type { Scope } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { type BotToolArea, type BotToolContext, defineBotTool } from '../bot-tool.factory';
import { BotToolboxFactory } from '../bot-toolbox.factory';

/**
 * What a turn is offered. A bot's tools act as its owner, so a message sent
 * through an API token scoped to `bots:write` must not reach, through the
 * bot, sessions or tasks the token itself could not: the turn is offered only
 * the tools its credential's scopes cover. A browser session (no scopes) is
 * offered all of them. The prompt's list and the bound tools agree. A tool
 * the owner's own roles do not cover stays offered, and its call is refused
 * before it runs, saying which permission they need.
 */
const startSession = vi.fn(async () => 'ok');

const tool = (name: string, scope: Scope, run = async () => 'ok') =>
  defineBotTool({
    name,
    scope,
    description: `${name}.`,
    input: z.object({}),
    asks: true,
    summarize: () => name,
    run,
  });

const area: BotToolArea = {
  definitions: () => [
    tool('list_sessions', 'sessions:read'),
    tool('start_session', 'sessions:write', startSession),
    tool('create_task', 'tasks:write'),
  ],
};

/** The toolbox over the areas given, every other of its positional areas offering nothing. */
function toolboxOf(...areas: BotToolArea[]): BotToolboxFactory {
  const none: BotToolArea = { definitions: () => [] };
  const all = Array.from({ length: BotToolboxFactory.length }, (_, i) => areas[i] ?? none);
  return new (BotToolboxFactory as unknown as new (...areas: BotToolArea[]) => BotToolboxFactory)(
    ...all,
  );
}

const toolbox = toolboxOf(area);

const context: BotToolContext = {
  owner: emptyScope('owner-1', 'org-1'),
  organizationId: 'org-1',
  botId: 'bot-1',
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'UTC',
  permission: 'full',
  budget: new BotTurnBudget(),
  credentialScopes: null,
  approvals: { request: vi.fn() },
};

/** An owner whose roles cover everything these tools need. */
const EVERYTHING: ReadonlySet<Scope> = new Set<Scope>([
  'sessions:read',
  'sessions:write',
  'tasks:write',
]);

const names = (granted: readonly Scope[] | null) =>
  toolbox.tools(context, granted, EVERYTHING).map((bound) => bound.name);

describe('BotToolboxFactory', () => {
  it('offers a browser session every tool', () => {
    expect(names(null)).toEqual(['list_sessions', 'start_session', 'create_task']);
  });

  it('offers a token only the tools its scopes cover, a write scope covering its read', () => {
    expect(names(['sessions:write'])).toEqual(['list_sessions', 'start_session']);
    expect(names(['sessions:read'])).toEqual(['list_sessions']);
  });

  it('offers a token scoped to the bot alone none of the workspace’s tools', () => {
    expect(names(['bots:write'])).toEqual([]);
    expect(toolbox.catalog(['bots:write'])).toEqual([]);
  });

  it('runs an approved call only under the scopes of the turn that asked', async () => {
    const signal = new AbortController().signal;
    const call = { tool: 'start_session', input: {} };
    const ran = await toolbox.runApproved(
      { ...context, permission: 'auto' },
      ['sessions:write'],
      EVERYTHING,
      call,
      signal,
    );
    expect(ran).toEqual({ content: 'ok', isError: false });
    const refused = await toolbox.runApproved(
      { ...context, permission: 'auto' },
      ['bots:write'],
      EVERYTHING,
      call,
      signal,
    );
    expect(refused.isError).toBe(true);
    expect(refused.content).toContain('Not run');
  });

  it('keeps offering a tool the owner’s roles do not cover, and refuses its call before any card, saying which permission they need', async () => {
    const asking = { ...context, permission: 'auto' as const, approvals: { request: vi.fn() } };
    const readOnly: ReadonlySet<Scope> = new Set<Scope>(['sessions:read', 'tasks:write']);

    const bound = toolbox.tools(asking, null, readOnly);
    const start = bound.find((candidate) => candidate.name === 'start_session');
    const result = await start?.run({}, { signal: new AbortController().signal });

    expect(bound.map((candidate) => candidate.name)).toEqual([
      'list_sessions',
      'start_session',
      'create_task',
    ]);
    expect(result?.isError).toBe(true);
    expect(result?.content).toContain('(sessions:write)');
    expect(result?.content).toContain('granted');
    expect(startSession).not.toHaveBeenCalled();
    expect(asking.approvals.request).not.toHaveBeenCalled();
  });

  it('runs nothing approved once the owner has lost the role the card needed', async () => {
    const result = await toolbox.runApproved(
      { ...context, permission: 'auto', approvalId: 'approval-1' },
      null,
      new Set<Scope>(['sessions:read']),
      { tool: 'start_session', input: {} },
      new AbortController().signal,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain('(sessions:write)');
  });
});
