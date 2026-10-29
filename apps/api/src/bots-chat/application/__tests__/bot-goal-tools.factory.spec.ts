/**
 * The bot's goal tools (`25-bots.md` §4.1). What breaks this: a continuation
 * setting a fresh goal, which would let a goal renew itself forever; a goal
 * that forgets the setting turn's reach, so its continuations reach further
 * than the message that led to them; `end_goal` leaving the goal open.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import { Some } from 'oxide.ts';
import { BotGoalMapper } from '../../bot-goal.mapper';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotGoalEntity } from '../../domain/bot-goal.entity';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotGoalToolsFactory } from '../bot-goal-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

function turn(origin: 'message' | 'goal'): BotTurnEntity {
  return BotTurnEntity.queue({
    organizationId: 'org-1',
    botId: 'bot-1',
    requestedByUserId: 'owner-1',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
    origin,
  });
}

function setup(origin: 'message' | 'goal', stored: BotGoalEntity | null = null) {
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
    set: vi.fn<BotGoalRepositoryPort['set']>(async () => stored),
    end: vi.fn<BotGoalRepositoryPort['end']>(async () => true),
  } satisfies Partial<BotGoalRepositoryPort>;
  const turns = {
    findForRun: vi.fn<BotTurnRepositoryPort['findForRun']>(async () => Some(turn(origin))),
  } satisfies Partial<BotTurnRepositoryPort>;
  const factory = new BotGoalToolsFactory(
    goals as unknown as BotGoalRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    new BotGoalMapper(),
  );
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'Europe/Madrid',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    approvals: { request: vi.fn<BotApprovalRequesterPort['request']>() },
    budget: new BotTurnBudget(),
    credentialScopes: ['bots:read', 'bots:write'],
  };
  const call = (name: string, input: unknown) => {
    const definition = factory.definitions().find((candidate) => candidate.name === name);
    if (!definition) throw new Error(`no tool ${name}`);
    return definition.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { goals, call };
}

describe('BotGoalToolsFactory', () => {
  it('sets a goal for the turn that asked, with its reach and the default limit, without a card', async () => {
    const { goals, call } = setup('message');
    const result = await call('set_goal', { objective: 'Get the release branch green' });

    expect(goals.set.mock.calls[0][0]).toMatchObject({
      botId: 'bot-1',
      originTurnId: 'turn-1',
      objective: 'Get the release branch green',
      limit: 5,
      continuations: 0,
      credentialScopes: ['bots:read', 'bots:write'],
      timeZone: 'Europe/Madrid',
    });
    expect(result).toMatchObject({ isError: false });
    expect(JSON.stringify(result)).toContain('Goal set');
  });

  it('refuses to set a goal from a continuation, and stores nothing', async () => {
    const { goals, call } = setup('goal');
    const result = await call('set_goal', { objective: 'Keep going forever' });

    expect(goals.set).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain('A continuation cannot set a goal');
  });

  it('ends the goal with no line of its own: the call is the record', async () => {
    const open = BotGoalEntity.set({
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Triage the bugs',
      limit: 3,
      credentialScopes: null,
      timeZone: null,
    });
    const { goals, call } = setup('goal', open);
    await call('end_goal', {});

    expect(goals.end).toHaveBeenCalledWith(open, null);
  });
});
