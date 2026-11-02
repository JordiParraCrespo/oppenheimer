/**
 * The bot's goal tools (`25-bots.md` §4.1). What breaks this: a continuation
 * offered `set_goal`, which would let a goal renew itself forever; a goal
 * that forgets the setting turn's reach, so its continuations reach further
 * than the message that led to them; ending or replacing a goal leaving its
 * waiting continuation to run work the bot just called done.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import { BotGoalMapper } from '../../bot-goal.mapper';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import { BotGoalEntity } from '../../domain/bot-goal.entity';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import type { BotGoalResolver } from '../bot-goal.resolver';
import { BotGoalToolsFactory } from '../bot-goal-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

function open(objective = 'Triage the bugs'): BotGoalEntity {
  return BotGoalEntity.set({
    organizationId: 'org-1',
    botId: 'bot-1',
    originTurnId: 'turn-0',
    objective,
    limit: 3,
    credentialScopes: null,
    timeZone: null,
  });
}

function setup(stored: BotGoalEntity | null = null) {
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
    set: vi.fn<BotGoalRepositoryPort['set']>(async () => stored),
  } satisfies Partial<BotGoalRepositoryPort>;
  const goalsOf = {
    end: vi.fn<BotGoalResolver['end']>(async () => true),
    cancelWaiting: vi.fn<BotGoalResolver['cancelWaiting']>(async () => undefined),
  };
  const factory = new BotGoalToolsFactory(
    goals as unknown as BotGoalRepositoryPort,
    goalsOf as unknown as BotGoalResolver,
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
  const definition = (name: string) => {
    const found = factory.definitions().find((candidate) => candidate.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found;
  };
  const call = (name: string, input: unknown) =>
    definition(name).bind(context).run(input, { signal: new AbortController().signal });
  return { goals, goalsOf, definition, call };
}

describe('BotGoalToolsFactory', () => {
  it('sets a goal for the turn that asked, with its reach and the default limit, without a card', async () => {
    const { goals, call } = setup();
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
    expect(JSON.stringify(result)).toContain('Goal set');
  });

  it('is not offered to a continuation, so a goal never renews itself', () => {
    expect(setup().definition('set_goal').notOn).toEqual(['goal']);
    expect(setup().definition('end_goal').notOn).toEqual([]);
  });

  it('cancels the continuation the goal it replaces left waiting', async () => {
    const replaced = open();
    const { goalsOf, call } = setup(replaced);
    await call('set_goal', { objective: 'Ship it' });
    expect(goalsOf.cancelWaiting).toHaveBeenCalledWith(replaced, null);
  });

  it('ends the goal with no line of its own, through the one end that cancels what waits', async () => {
    const goal = open();
    const { goalsOf, call } = setup(goal);
    await call('end_goal', {});
    expect(goalsOf.end).toHaveBeenCalledWith(goal, null, null);
  });
});
