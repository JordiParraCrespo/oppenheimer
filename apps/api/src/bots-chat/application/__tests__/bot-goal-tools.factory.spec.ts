/**
 * The bot's goal tools (`25-bots.md` §4.1). What breaks this: a continuation
 * offered `set_goal`, which would let a goal renew itself forever; a goal
 * that forgets the setting turn's reach, so its continuations reach further
 * than the message that led to them; a goal's own turn ending it on its
 * word without the reviewer; blocked ending a goal the owner could resume;
 * ending or replacing a goal leaving its waiting continuation to run.
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
    tokenBudget: null,
    credentialScopes: null,
    timeZone: null,
  });
}

function setup(stored: BotGoalEntity | null = null, origin: BotToolContext['origin'] = 'message') {
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
    pause: vi.fn<BotGoalRepositoryPort['pause']>(async () => true),
    claim: vi.fn<BotGoalRepositoryPort['claim']>(async () => true),
  } satisfies Partial<BotGoalRepositoryPort>;
  const goalsOf = {
    end: vi.fn<BotGoalResolver['end']>(async () => true),
    set: vi.fn<BotGoalResolver['set']>(async () => stored),
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
    origin,
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
  it('sets a goal for the turn that asked, with its reach, no limit and the budget it names', async () => {
    const { goalsOf, call } = setup();
    const result = await call('set_goal', {
      objective: 'Get the release branch green',
      token_budget: 2_000_000,
    });

    expect(goalsOf.set.mock.calls[0][0]).toMatchObject({
      botId: 'bot-1',
      originTurnId: 'turn-1',
      objective: 'Get the release branch green',
      limit: null,
      tokenBudget: 2_000_000,
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

  it('sets it through the one set that cancels what the goal it replaces left waiting', async () => {
    const replaced = open();
    const { goalsOf, call } = setup(replaced);
    const result = await call('set_goal', { objective: 'Ship it' });
    expect(goalsOf.set).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).toContain('Triage the bugs');
  });

  it('ends the goal at once from a turn that is not its own, with no line of its own', async () => {
    const goal = open();
    const { goalsOf, call } = setup(goal);
    await call('end_goal', { outcome: 'met', reason: 'The person asked me to stop' });
    expect(goalsOf.end).toHaveBeenCalledWith(goal, null, null);
  });

  it('only claims the goal met from its own turn, for the reviewer to check', async () => {
    const goal = open();
    const { goals, goalsOf, call } = setup(goal, 'goal');
    const result = await call('end_goal', { outcome: 'met', reason: 'pnpm test exits 0' });
    expect(goalsOf.end).not.toHaveBeenCalled();
    expect(goal.claim).toBe('pnpm test exits 0');
    expect(goals.claim).toHaveBeenCalledWith(goal);
    expect(JSON.stringify(result)).toContain('reviewer');
  });

  it('pauses a blocked goal with its line, and cancels what waits, rather than ending it', async () => {
    const goal = open();
    const { goals, goalsOf, call } = setup(goal, 'goal');
    await call('end_goal', { outcome: 'blocked', reason: 'I need the deploy key' });
    expect(goalsOf.end).not.toHaveBeenCalled();
    expect(goal.paused).toMatchObject({ reason: 'blocked', note: 'I need the deploy key' });
    expect(goals.pause.mock.calls[0][1].event).toMatchObject({ activity: 'paused' });
    // Paused mid-turn: the turn's end still owes its spend.
    expect(goals.pause.mock.calls[0][2]).toBe('owed');
    expect(goalsOf.cancelWaiting).toHaveBeenCalledWith(goal, null);
  });

  // What breaks this: a blocked pause from a turn that is not the goal's own
  // marked as owing its spend, which no turn's end will ever count, so Resume
  // lifts it in place and waits for an end that never comes.
  it('owes no spend for a blocked pause from a turn that is not the goal’s own', async () => {
    const { goals, call } = setup(open(), 'message');
    await call('end_goal', { outcome: 'blocked', reason: 'I need the deploy key' });
    expect(goals.pause.mock.calls[0][2]).toBe('counted');
  });

  // What breaks this: the bot saying met after it said blocked in one turn,
  // the claim written on the paused goal.
  it('takes no claim on a paused goal', async () => {
    const goal = open();
    goal.pause('blocked', 'I need the deploy key', new Date());
    const { goals, call } = setup(goal, 'goal');
    const result = await call('end_goal', { outcome: 'met', reason: 'pnpm test exits 0' });
    expect(goals.claim).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain('paused');
  });
});
