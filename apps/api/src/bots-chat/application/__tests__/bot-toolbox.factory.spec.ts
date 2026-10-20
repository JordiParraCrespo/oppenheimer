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
 * offered all of them. The prompt's list and the bound tools agree.
 */
const tool = (name: string, scope: Scope) =>
  defineBotTool({
    name,
    scope,
    description: `${name}.`,
    input: z.object({}),
    run: async () => 'ok',
  });

const area: BotToolArea = {
  definitions: () => [
    tool('list_sessions', 'sessions:read'),
    tool('start_session', 'sessions:write'),
    tool('create_task', 'tasks:write'),
  ],
};

// The toolbox takes its eleven areas positionally; one stands in, the rest offer nothing.
const none: BotToolArea = { definitions: () => [] };
const toolbox = new (
  BotToolboxFactory as unknown as new (
    ...areas: BotToolArea[]
  ) => BotToolboxFactory
)(area, none, none, none, none, none, none, none, none, none, none);

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

const names = (granted: readonly Scope[] | null) =>
  toolbox.tools(context, granted).map((bound) => bound.name);

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
      call,
      signal,
    );
    expect(ran).toEqual({ content: 'ok', isError: false });
    const refused = await toolbox.runApproved(
      { ...context, permission: 'auto' },
      ['bots:write'],
      call,
      signal,
    );
    expect(refused.isError).toBe(true);
    expect(refused.content).toContain('Not run');
  });
});
