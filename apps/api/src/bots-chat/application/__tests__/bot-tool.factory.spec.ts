import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { z } from 'zod/v4';
import { MailErrors } from '../../../mail/domain/mail.errors';
import type { BotAutoVerdict } from '../../domain/bot-auto-review.policy';
import { BotPermissionRuleEntity } from '../../domain/bot-permission-rule.entity';
import type { BotRuleVerdict } from '../../domain/bot-rule-review.policy';
import { BotToolPermissionEntity } from '../../domain/bot-tool-permission.entity';
import { NO_PERMISSIONS, permissionsOf } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { type BotToolContext, defineBotTool } from '../bot-tool.factory';

/**
 * How an asking tool asks: under Ask for approval its call is
 * checked, then becomes a Needs input card and never runs; the model is told
 * to end its turn, or to wait when a card is already up. Under Approve for
 * me a reviewer reads the call first and lets it run or raises that card.
 * Full access runs it, cards a tool would escalate to included; an approved
 * call is carried out through `runApproved`, which never asks.
 */
function setup(
  options: {
    waiting?: boolean;
    summarize?: () => string;
    asks?: true | 'always' | 'card';
    escalates?: boolean;
    /** Pins the call's host, as a merge pins the head it was read at. */
    pins?: string;
  } = {},
) {
  const run = vi.fn(async (input: { task: string; host?: string }) => `Started ${input.task}`);
  const tool = defineBotTool({
    name: 'start_thing',
    asks: options.asks ?? true,
    ...(options.escalates && { escalates: () => true }),
    ...(options.pins && {
      normalize: (input: { task: string; host?: string }) => ({ ...input, host: options.pins }),
    }),
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
    permission: 'ask',
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    approvals,
    ...extra,
  });
  const call = (
    input: unknown,
    extra?: Partial<BotToolContext>,
    signal: AbortSignal = new AbortController().signal,
  ) => tool.bind(context(extra)).run(input, { signal });
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
  it('raises a card for a valid call under Ask for approval, runs nothing, and tells the model to end its turn', async () => {
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

describe('defineBotTool, Auto’s reviewer', () => {
  const allow: BotAutoVerdict = {
    outcome: 'allow',
    risk: 'medium',
    authorization: 'high',
    reason: 'You asked to deploy.',
  };
  const ask: BotAutoVerdict = {
    outcome: 'ask',
    risk: 'high',
    authorization: 'none',
    reason: 'Nothing you said asks for this.',
  };
  const reviewer = (verdict: () => Promise<BotAutoVerdict>) => ({ review: vi.fn(verdict) });

  it('runs a call the reviewer clears, without a card, saying why on its line', async () => {
    const { run, approvals, call } = setup();
    const auto = reviewer(async () => allow);
    const result = await call({ task: 'deploy' }, { permission: 'auto', autoReviewer: auto });
    expect(auto.review).toHaveBeenCalledWith(
      { tool: 'start_thing', summary: 'Start deploy', input: { task: 'deploy' } },
      expect.any(AbortSignal),
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(approvals.request).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ allowedBy: 'Auto-approved: You asked to deploy.' });
  });

  it('runs the call as the reviewer read it, normalized, never the model’s input again', async () => {
    // A merge is normalized to the head it was read at; running the raw input
    // instead would merge whatever was pushed while the review ran.
    const { run, call } = setup({ pins: 'head-at-review' });
    const auto = reviewer(async () => allow);
    await call({ task: 'deploy' }, { permission: 'auto', autoReviewer: auto });
    expect(auto.review.mock.calls[0][0]).toMatchObject({ input: { host: 'head-at-review' } });
    expect(run.mock.calls[0][0]).toEqual({ task: 'deploy', host: 'head-at-review' });
  });

  it('raises the card for a call the reviewer will not clear, its reason on the card', async () => {
    const { run, approvals, call } = setup();
    await call({ task: 'deploy' }, { permission: 'auto', autoReviewer: reviewer(async () => ask) });
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewNote: 'Auto left this to you: Nothing you said asks for this.',
      }),
    );
  });

  it('neither runs the call nor raises its card when the turn was stopped during the review', async () => {
    const { run, approvals, call } = setup();
    const stop = new AbortController();
    const auto = reviewer(async () => {
      stop.abort();
      return allow;
    });
    const result = await call(
      { task: 'deploy' },
      { permission: 'auto', autoReviewer: auto },
      stop.signal,
    );
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
  });

  it('raises the card when the review fails, never running the call unreviewed', async () => {
    const { run, approvals, call } = setup();
    const broken = reviewer(async () => {
      throw new Error('provider down');
    });
    await call({ task: 'deploy' }, { permission: 'auto', autoReviewer: broken });
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewNote: 'Auto could not review this just now, so it asks.',
      }),
    );
  });

  it('keeps the card the owner asked for: a tool set to Ask, one that always asks, one that escalates', async () => {
    const setAsk = permissionsOf(
      [
        BotToolPermissionEntity.decide({
          organizationId: 'org-1',
          botId: 'bot-1',
          tool: 'start_thing',
          decision: 'ask',
          userId: 'owner-1',
        }),
      ],
      [],
    );
    for (const [options, permissions] of [
      [{}, setAsk],
      [{ asks: 'always' as const }, NO_PERMISSIONS],
      [{ escalates: true }, NO_PERMISSIONS],
    ] as const) {
      const { run, approvals, call } = setup(options);
      const auto = reviewer(async () => allow);
      await call({ task: 'deploy' }, { permission: 'auto', permissions, autoReviewer: auto });
      expect(auto.review).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
      expect(approvals.request).toHaveBeenCalledTimes(1);
    }
  });

  it('lets an ask rule win over the reviewer, which is then not asked', async () => {
    const { run, approvals, call } = setup();
    const askProd = BotPermissionRuleEntity.write({
      organizationId: 'org-1',
      botId: 'bot-1',
      userId: 'owner-1',
      effect: 'ask',
      text: 'Ask before prod',
    });
    const auto = reviewer(async () => allow);
    await call(
      { task: 'deploy' },
      {
        permission: 'auto',
        permissions: permissionsOf([], [askProd]),
        reviewer: {
          review: async () => ({
            effect: 'ask',
            rule: { id: askProd.id, text: askProd.text },
          }),
        },
        autoReviewer: auto,
      },
    );
    expect(auto.review).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({ reviewNote: 'Paused by your rule “Ask before prod”' }),
    );
  });

  it('is never read under Ask for approval', async () => {
    const { approvals, call } = setup();
    const auto = reviewer(async () => allow);
    await call({ task: 'deploy' }, { permission: 'ask', autoReviewer: auto });
    expect(auto.review).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledTimes(1);
  });
});

describe('defineBotTool, Full access', () => {
  it('runs a call that always asks, or escalates, without a card', async () => {
    for (const options of [{ asks: 'always' as const }, { escalates: true }]) {
      const { run, approvals, call } = setup(options);
      await call({ task: 'deploy' }, { permission: 'full' });
      expect(approvals.request).not.toHaveBeenCalled();
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it('still raises the card of a tool that runs only from one', async () => {
    const { run, approvals, call } = setup({ asks: 'card' });
    await call({ task: 'deploy' }, { permission: 'full' });
    expect(run).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledTimes(1);
  });
});

describe('defineBotTool, a call a system’s rate limit stopped', () => {
  const resetAt = new Date(Date.now() + 60_000);
  const limited = new AppError(MailErrors.GMAIL_RATE_LIMITED, {
    detail:
      "Quota exceeded for quota metric 'Queries' of service 'gmail.googleapis.com' for consumer 'project_number:123'.",
    retryAfterSeconds: 60,
    extensions: { upstream: 'Gmail', retryAfterSeconds: 60, resetAt: resetAt.toISOString() },
  });
  const tool = defineBotTool({
    name: 'archive_mail',
    scope: 'mail:write',
    description: 'Archives mail.',
    input: z.object({}),
    run: async () => {
      throw limited;
    },
  });

  // What breaks this: the model reading Google's quota sentence (and our
  // project's number) as a failure, retrying at once, and the turn ending
  // with no time for whatever queues the next one.
  it('tells the model who is limiting and until when, without the provider’s text, and hands the engine the limit', async () => {
    const result = await tool
      .bind({
        owner: emptyScope('owner-1', 'org-1'),
        organizationId: 'org-1',
        botId: 'bot-1',
        turnId: 'turn-1',
        homeHostId: null,
        timeZone: 'UTC',
        permission: 'full',
        permissions: NO_PERMISSIONS,
        budget: new BotTurnBudget(),
        approvals: { request: vi.fn<BotApprovalRequesterPort['request']>() },
      })
      .run({}, { signal: new AbortController().signal });

    expect(result.isError).toBe(true);
    expect(result.content).toContain(
      `MAIL_008: Gmail is limiting our requests until ${resetAt.toISOString()}`,
    );
    expect(result.content).toContain('Do not retry it in this turn');
    expect(result.content).not.toContain('did nothing');
    expect(result.content).not.toContain('project_number');
    expect(JSON.parse(result.data?.rateLimit ?? '{}')).toEqual({
      system: 'Gmail',
      resetAt: resetAt.toISOString(),
    });
  });
});
