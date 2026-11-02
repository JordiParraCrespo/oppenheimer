import { z } from 'zod/v4';
import { emptyScope } from '../../../authz/domain/access-scope.types';
import { BotPermissionRuleEntity } from '../../domain/bot-permission-rule.entity';
import type { BotRuleVerdict } from '../../domain/bot-rule-review.policy';
import { BotToolPermissionEntity } from '../../domain/bot-tool-permission.entity';
import { NO_PERMISSIONS, permissionsOf } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { type BotToolContext, defineBotTool } from '../bot-tool.factory';

/**
 * How an asking tool asks (`25-bots.md` §5): under Approve for me its call is
 * checked, then becomes a Needs input card and never runs; the model is told
 * to end its turn, or to wait when a card is already up. Full access runs it;
 * an approved call is carried out through `runApproved`, which never asks.
 */
function setup(options: { waiting?: boolean; summarize?: () => string } = {}) {
  const run = vi.fn(async (input: { task: string; host?: string }) => `Started ${input.task}`);
  const tool = defineBotTool({
    name: 'start_thing',
    asks: true,
    scope: 'sessions:write',
    description: 'Starts a thing.',
    input: z.object({ task: z.string().min(1), host: z.string().optional() }),
    summarize: options.summarize ?? ((input) => `Start ${input.task}`),
    subject: (input) =>
      input.host ? { kind: 'host', key: input.host, label: `host ${input.host}` } : null,
    run,
  });
  const approvals = {
    request: vi.fn<BotApprovalRequesterPort['request']>(async () =>
      options.waiting
        ? { status: 'waiting', summary: 'Stop the old thing' }
        : { status: 'requested', approvalId: 'approval-1' },
    ),
  };
  const context = (extra: Partial<BotToolContext> = {}): BotToolContext => ({
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'UTC',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    approvals,
    ...extra,
  });
  const call = (input: unknown, extra?: Partial<BotToolContext>) =>
    tool.bind(context(extra)).run(input, { signal: new AbortController().signal });
  return { run, approvals, call };
}

describe('defineBotTool, a read-only tool', () => {
  it('cannot also ask first: a child offered it would raise a card no one asked for', () => {
    expect(() =>
      defineBotTool({
        name: 'peek',
        scope: 'sessions:read',
        description: 'Peeks.',
        input: z.object({}),
        readOnly: true,
        asks: true,
        summarize: () => 'peek',
        run: async () => 'ok',
      }),
    ).toThrow('cannot both ask first and be read-only');
  });
});

describe('defineBotTool, an asking tool', () => {
  it('raises a card for a valid call under Approve for me, runs nothing, and tells the model to end its turn', async () => {
    const { run, approvals, call } = setup();
    const result = await call({ task: 'deploy', host: 'b2' });
    expect(approvals.request).toHaveBeenCalledWith({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      tool: 'start_thing',
      input: { task: 'deploy', host: 'b2' },
      summary: 'Start deploy',
      subject: { kind: 'host', key: 'b2', label: 'host b2' },
      sharesOutside: false,
      perCallOnly: false,
      reviewNote: null,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content).toContain('"Start deploy"');
    expect(result.content).toContain('End your turn now');
    expect(run).not.toHaveBeenCalled();
  });

  it('checks the input before asking: a bad call is an error and raises no card', async () => {
    const { approvals, call } = setup();
    const result = await call({ task: '' });
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('Invalid input');
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('tells the model to wait when a card is already up, naming it, and runs nothing', async () => {
    const { run, call } = setup({ waiting: true });
    const result = await call({ task: 'deploy' });
    expect(result.content).toContain('"Stop the old thing"');
    expect(result.content).toContain('only one can wait at a time');
    expect(run).not.toHaveBeenCalled();
  });

  it('still raises the card when the summary cannot be built, saying what would run', async () => {
    const { approvals, call } = setup({
      summarize: () => {
        throw new Error('host lookup failed');
      },
    });
    await call({ task: 'deploy' });
    expect(approvals.request.mock.calls[0][0].summary).toBe('start_thing {"task":"deploy"}');
  });

  it('runs under Full access without asking', async () => {
    const { run, approvals, call } = setup();
    const result = await call({ task: 'deploy' }, { permission: 'full' });
    expect(result.content).toBe('Started deploy');
    expect(run).toHaveBeenCalledOnce();
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('carries out an approved call straight to its run: no asking, its approval id passed on', async () => {
    const { run, approvals } = setup();
    const tool = defineBotTool({
      name: 'start_thing',
      asks: true,
      scope: 'sessions:write',
      description: 'Starts a thing.',
      input: z.object({ task: z.string().min(1) }),
      run,
    });
    const answer = await tool.runApproved(
      { task: 'deploy' },
      {
        owner: emptyScope('owner-1', 'org-1'),
        organizationId: 'org-1',
        botId: 'bot-1',
        turnId: 'turn-1',
        homeHostId: null,
        timeZone: 'UTC',
        permission: 'auto',
        permissions: NO_PERMISSIONS,
        budget: new BotTurnBudget(),
        approvalId: 'approval-1',
      },
      new AbortController().signal,
    );
    expect(answer).toEqual({ content: 'Started deploy', isError: false });
    expect(run.mock.calls[0][1]).toMatchObject({ approvalId: 'approval-1' });
    expect(approvals.request).not.toHaveBeenCalled();
  });
});

describe('defineBotTool, a call that starts a session', () => {
  const tool = defineBotTool({
    name: 'start_thing',
    scope: 'sessions:write',
    description: 'Starts a thing.',
    input: z.object({}),
    run: async () => ({ content: 'The agent is on it.', sessionId: 's-1' }),
  });
  const context = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'UTC',
    permission: 'full' as const,
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
  };

  it('hands the engine the session as data, apart from the words the model reads', async () => {
    const approvals = { request: vi.fn<BotApprovalRequesterPort['request']>() };
    const result = await tool
      .bind({ ...context, approvals })
      .run({}, { signal: new AbortController().signal });
    expect(result).toEqual({
      content: 'The agent is on it.',
      isError: false,
      data: { sessionId: 's-1' },
    });
  });

  it('answers an approved call with the session it started', async () => {
    const answer = await tool.runApproved(
      {},
      { ...context, approvalId: 'approval-1' },
      new AbortController().signal,
    );
    expect(answer).toEqual({ content: 'The agent is on it.', isError: false, sessionId: 's-1' });
  });
});

describe('defineBotTool, what the owner set for an asking tool', () => {
  const owner = { organizationId: 'org-1', botId: 'bot-1', userId: 'owner-1', tool: 'start_thing' };
  const granted = permissionsOf(
    [
      BotToolPermissionEntity.grant({
        ...owner,
        subject: { kind: 'host', key: 'b2', label: 'host b2' },
      }),
    ],
    [],
  );

  it('runs a call on a granted subject without a card, and says why on its step', async () => {
    const { run, approvals, call } = setup();
    const result = await call({ task: 'deploy', host: 'b2' }, { permissions: granted });
    expect(run).toHaveBeenCalledTimes(1);
    expect(approvals.request).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ allowedBy: 'Always allowed for host b2' });
  });

  it('still asks for the same tool on another subject, or on none, offering the subject', async () => {
    const { run, approvals, call } = setup();
    await call({ task: 'deploy', host: 'b3' }, { permissions: granted });
    await call({ task: 'deploy' }, { permissions: granted });
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request.mock.calls.map(([request]) => request.subject)).toEqual([
      { kind: 'host', key: 'b3', label: 'host b3' },
      null,
    ]);
  });

  it('runs every call without a card once the owner set the tool to Allow, and asks again on Ask', async () => {
    const allow = permissionsOf(
      [BotToolPermissionEntity.decide({ ...owner, decision: 'allow' })],
      [],
    );
    const ask = permissionsOf([BotToolPermissionEntity.decide({ ...owner, decision: 'ask' })], []);
    const { run, approvals, call } = setup();
    await call({ task: 'deploy' }, { permissions: allow });
    expect(run).toHaveBeenCalledTimes(1);
    await call({ task: 'deploy' }, { permission: 'full', permissions: ask });
    expect(run).toHaveBeenCalledTimes(1);
    expect(approvals.request).toHaveBeenCalledTimes(1);
  });
});

describe('defineBotTool, the owner’s rules', () => {
  const rule = (effect: 'allow' | 'ask', text: string) =>
    BotPermissionRuleEntity.write({
      organizationId: 'org-1',
      botId: 'bot-1',
      userId: 'owner-1',
      effect,
      text,
    });
  const allowDocs = rule('allow', 'Deploys are fine');
  const askProd = rule('ask', 'Ask before prod');
  const reviewer = (verdict: () => Promise<BotRuleVerdict>) => ({ review: vi.fn(verdict) });

  it('lets a call that would ask run when an allow rule matches, saying which rule', async () => {
    const { run, approvals, call } = setup();
    const review = reviewer(async () => ({
      effect: 'allow',
      rule: { id: allowDocs.id, text: allowDocs.text },
    }));
    const result = await call(
      { task: 'deploy' },
      { permissions: permissionsOf([], [allowDocs]), reviewer: review },
    );
    expect(review.review).toHaveBeenCalledWith(
      { tool: 'start_thing', summary: 'Start deploy', input: { task: 'deploy' } },
      [expect.objectContaining({ effect: 'allow', text: 'Deploys are fine' })],
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(approvals.request).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({
      allowedBy: 'Auto-approved by your rule “Deploys are fine”',
    });
  });

  it('pauses a call that would run under Full access when an ask rule matches, saying why on the card', async () => {
    const { run, approvals, call } = setup();
    const review = reviewer(async () => ({
      effect: 'ask',
      rule: { id: askProd.id, text: askProd.text },
    }));
    await call(
      { task: 'deploy' },
      { permission: 'full', permissions: permissionsOf([], [askProd]), reviewer: review },
    );
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({ reviewNote: 'Paused by your rule “Ask before prod”' }),
    );
  });

  it('asks when the review fails, whichever way the call stood', async () => {
    const { run, approvals, call } = setup();
    const broken = reviewer(async () => {
      throw new Error('provider down');
    });
    await call({ task: 'a' }, { permissions: permissionsOf([], [allowDocs]), reviewer: broken });
    await call(
      { task: 'b' },
      { permission: 'full', permissions: permissionsOf([], [askProd]), reviewer: broken },
    );
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request.mock.calls.map(([request]) => request.reviewNote)).toEqual([
      'Your rules could not be checked just now, so this asks.',
      'Your rules could not be checked just now, so this asks.',
    ]);
  });

  it('spends no review where no rule could change the outcome', async () => {
    const { run, approvals, call } = setup();
    const review = reviewer(async () => ({ effect: 'none' }));
    // Only ask rules, on a call that asks anyway; only allow rules, on one that runs.
    await call({ task: 'a' }, { permissions: permissionsOf([], [askProd]), reviewer: review });
    await call(
      { task: 'b' },
      { permission: 'full', permissions: permissionsOf([], [allowDocs]), reviewer: review },
    );
    expect(review.review).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
