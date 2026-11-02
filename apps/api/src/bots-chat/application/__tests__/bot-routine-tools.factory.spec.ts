import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '../../../authz/domain/access-scope.types';
import { SaveBotRoutineCommand } from '../../../automations/commands/save-bot-routine/save-bot-routine.command';
import type { AutomationEntity } from '../../../automations/domain/automation.entity';
import { GmailConnectionEntity } from '../../../mail/domain/gmail-connection.entity';
import { FindGmailConnectionsQuery } from '../../../mail/queries/find-gmail-connections/find-gmail-connections.query';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotMailAccountsResolver } from '../bot-mail-accounts.resolver';
import { BotRoutineToolsFactory } from '../bot-routine-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * `update_routine` (`26-bot-routines.md` §4), as Grok Bot's one routine tool:
 * what it asks for and what it runs as it comes. What breaks this: a pause or
 * a list raising a card the owner has to click, a save or a run the bot
 * starts going ahead without one,
 * a routine saved with a broader credential than the turn's, another bot's
 * routine touched, or a mail trigger's card storing an account name that
 * could later mean another account.
 */
const ROUTINE = '0d9f6a4e-0000-4000-8000-000000000001';

const routine = {
  id: ROUTINE,
  name: 'Morning PR digest',
  isPaused: false,
  triggers: [],
  revision: { prompt: 'List the open pull requests.' },
} as unknown as AutomationEntity;

const ACCOUNT = GmailConnectionEntity.connect({
  organizationId: 'org-1',
  userId: 'owner-1',
  googleSubject: 'sub-1',
  accountEmail: 'ana@gmail.test',
  label: 'Personal',
  refreshTokenSealed: Buffer.from('sealed'),
  scopes: [],
});

function setup() {
  const execute = vi.fn(async () => ROUTINE);
  const commandBus = { execute } as unknown as CommandBus;
  const queryBus = {
    execute: vi.fn(async (query: unknown) =>
      query instanceof FindGmailConnectionsQuery
        ? [ACCOUNT]
        : { automations: [routine], digests: new Map() },
    ),
  } as unknown as QueryBus;
  const [tool] = new BotRoutineToolsFactory(
    commandBus,
    queryBus,
    new BotMailAccountsResolver(queryBus),
  ).definitions();
  const approvals = {
    request: vi.fn<BotApprovalRequesterPort['request']>(async () => ({
      status: 'requested',
      approvalId: 'approval-1',
    })),
  };
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'Europe/Madrid',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    credentialScopes: ['automations:write'],
    approvals,
  };
  const call = (input: unknown) =>
    tool.bind(context).run(input, { signal: new AbortController().signal });
  return { call, execute, approvals };
}

const create = {
  action: 'create',
  name: 'Morning PR digest',
  prompt: 'List the open pull requests.',
  triggers: [{ source: 'schedule', frequency: 'weekdays', hour: 9, minute: 0 }],
};

describe('update_routine', () => {
  it('asks before saving a routine, with what it will do, and saves nothing yet', async () => {
    const { call, execute, approvals } = setup();
    await call(create);
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'update_routine',
        summary: expect.stringContaining('Save routine "Morning PR digest": weekdays at 09:00'),
      }),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('asks before saving a mail routine, storing the account by its id and naming its address', async () => {
    const { call, execute, approvals } = setup();
    await call({
      ...create,
      triggers: [{ source: 'gmail', account: 'personal', query: 'from:billing@x.test' }],
    });
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          triggers: [{ source: 'gmail', account: ACCOUNT.id, query: 'from:billing@x.test' }],
        }),
        summary: expect.stringContaining('new mail in'),
      }),
    );
    expect(approvals.request.mock.calls[0][0].summary).toContain('ana@gmail.test');
    expect(approvals.request.mock.calls[0][0].summary).toContain('matching "from:billing@x.test"');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a mail routine on an account the person has not connected, before any card', async () => {
    const { call, execute, approvals } = setup();
    const result = await call({ ...create, triggers: [{ source: 'gmail', account: 'Work' }] });
    expect(result.content).toContain('No connected Gmail account is "Work"');
    expect(approvals.request).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('pauses at once, with no card, and answers the list again', async () => {
    const { call, execute, approvals } = setup();
    const result = await call({ action: 'pause', routine_id: ROUTINE });
    expect(approvals.request).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith(expect.any(SaveBotRoutineCommand));
    expect(execute.mock.calls[0][0]).toMatchObject({
      botId: 'bot-1',
      routineId: ROUTINE,
      changes: { enabled: false },
    });
    expect(result.content).toContain(`${ROUTINE} "Morning PR digest"`);
  });

  it('asks before resuming, deleting or running one now, which spend or lose something', async () => {
    const { call, approvals, execute } = setup();
    await call({ action: 'resume', routine_id: ROUTINE });
    await call({ action: 'delete', routine_id: ROUTINE });
    await call({ action: 'run_now', routine_id: ROUTINE });
    expect(approvals.request).toHaveBeenCalledTimes(3);
    expect(approvals.request.mock.calls[1][0].summary).toBe('Delete routine "Morning PR digest"');
    expect(approvals.request.mock.calls[2][0].summary).toBe('Run routine "Morning PR digest"');
    expect(execute).not.toHaveBeenCalled();
  });

  it("saves an approved routine with the turn's zone and the turn's credential scopes", async () => {
    const { execute } = setup();
    const queryBus = {
      execute: vi.fn(async () => ({ automations: [], digests: new Map() })),
    } as unknown as QueryBus;
    const [tool] = new BotRoutineToolsFactory(
      { execute } as unknown as CommandBus,
      queryBus,
      new BotMailAccountsResolver(queryBus),
    ).definitions();
    await tool.runApproved(
      create,
      {
        owner: emptyScope('owner-1', 'org-1'),
        organizationId: 'org-1',
        botId: 'bot-1',
        turnId: 'turn-1',
        homeHostId: null,
        timeZone: 'Europe/Madrid',
        permission: 'auto',
        permissions: NO_PERMISSIONS,
        budget: new BotTurnBudget(),
        credentialScopes: ['automations:write'],
        approvalId: 'approval-1',
      },
      new AbortController().signal,
    );
    expect(execute.mock.calls[0][0]).toMatchObject({
      routineId: null,
      credentialScopes: ['automations:write'],
      changes: {
        name: 'Morning PR digest',
        triggers: [{ source: 'schedule', frequency: 'weekdays', timezone: 'Europe/Madrid' }],
      },
    });
  });

  it("refuses a routine that is not this bot's, in words, and touches nothing", async () => {
    const { call, execute } = setup();
    const result = await call({
      action: 'pause',
      routine_id: '0d9f6a4e-0000-4000-8000-000000000009',
    });
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('No routine of yours');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a weekly schedule with no days before any card is raised', async () => {
    const { call, approvals } = setup();
    const result = await call({
      ...create,
      triggers: [{ source: 'schedule', frequency: 'weekly', hour: 9, minute: 0 }],
    });
    expect(result.content).toContain('Trigger 1 is not valid');
    expect(approvals.request).not.toHaveBeenCalled();
  });
});
