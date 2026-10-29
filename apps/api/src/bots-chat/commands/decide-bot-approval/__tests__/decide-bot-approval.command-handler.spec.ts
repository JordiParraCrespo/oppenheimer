import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotQuestionAnswer, Scope } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import type {
  BotApprovalEffects,
  BotApprovalRepositoryPort,
} from '../../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotApprovalEntity } from '../../../domain/bot-approval.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { DecideBotApprovalCommand } from '../decide-bot-approval.command';
import { DecideBotApprovalCommandHandler } from '../decide-bot-approval.command-handler';

/**
 * Answering a Needs input card (`25-bots.md` §5). A yes moves the card and
 * stages the job that runs the call in one write (the run itself is
 * `RunApprovedCallCommandHandler`'s spec), keeping the deciding credential's
 * scopes; a no runs nothing and queues, in the same write, a turn opened by
 * an event saying it was denied, with the note, under what both the asking
 * turn's and the decider's scopes cover. A decision that loses the
 * conditional write, or arrives on a card already decided, is `BOTS_016` and
 * announces nothing. A card of questions is answered (or dismissed) instead:
 * its turn is told the answers, and a yes or answers that do not fit are
 * refused. The race is the integration suite's.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup(
  options: {
    decided?: boolean;
    loses?: boolean;
    askedWith?: readonly Scope[] | null;
    perCallOnly?: boolean;
    /** The card is `ask_user`'s questions rather than a call. */
    questions?: boolean;
  } = {},
) {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: scope.userId,
    name: 'Glm Bot',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'glm',
  });
  const asked = BotTurnEntity.queue({
    organizationId: bot.organizationId,
    botId: bot.id,
    requestedByUserId: scope.userId,
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    timeZone: 'Europe/Madrid',
    credentialScopes: options.askedWith ?? null,
  });
  const approval = options.questions
    ? BotApprovalEntity.request({
        organizationId: bot.organizationId,
        botId: bot.id,
        turnId: asked.id,
        tool: 'ask_user',
        input: {
          questions: [
            {
              header: null,
              question: 'Which repository?',
              multiSelect: false,
              options: [
                { label: 'acme/web', description: null },
                { label: 'acme/api', description: null },
              ],
            },
          ],
        },
        summary: 'Which repository?',
        perCallOnly: true,
      })
    : BotApprovalEntity.request({
        organizationId: bot.organizationId,
        botId: bot.id,
        turnId: asked.id,
        tool: 'start_session',
        input: { task: 'Fix the test', project_id: 'p-1' },
        summary: 'Start Claude Code on build-02 in acme/xrp: Fix the test',
        subject: { kind: 'project', key: 'p-1', label: 'XRP' },
        perCallOnly: options.perCallOnly,
      });
  if (options.decided) approval.expire(new Date());
  const approvals = {
    findOne: vi.fn(async () => Some(approval)),
    saveTransition: vi.fn(
      async (_approval: BotApprovalEntity, _effects?: BotApprovalEffects) => !options.loses,
    ),
  } satisfies Partial<BotApprovalRepositoryPort>;
  const turns = {
    findOne: vi.fn(async () => Some(asked)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const handler = new DecideBotApprovalCommandHandler(
    { bot: async () => bot } as BotLookupPort,
    approvals as unknown as BotApprovalRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
  );
  const decide = (
    decision: 'approve' | 'deny' | 'answer',
    note: string | null = null,
    credentialScopes: readonly Scope[] | null = null,
    reach: 'once' | 'tool' | 'subject' = 'once',
    answers: BotQuestionAnswer[] = [],
  ) =>
    handler.execute(
      new DecideBotApprovalCommand({
        scope,
        botId: bot.id,
        approvalId: approval.id,
        decision,
        reach,
        note,
        answers,
        deciderName: 'Ana',
        credentialScopes,
      }),
    );
  const effects = () => approvals.saveTransition.mock.calls[0][1] as BotApprovalEffects;
  return { bot, approval, approvals, stream, decide, effects };
}

describe('DecideBotApprovalCommandHandler', () => {
  it('approves and stages the call’s job in the same write, keeping the decider’s scopes', async () => {
    const { approval, approvals, decide, effects } = setup();
    await decide('approve', null, ['bots:write']);
    expect(approval).toMatchObject({
      status: 'approved',
      decidedByUserId: scope.userId,
      decidedWithScopes: ['bots:write'],
      result: null,
    });
    expect(approvals.saveTransition).toHaveBeenCalledTimes(1);
    expect(effects()).toEqual({ runCall: { by: 'Ana' } });
  });

  it('runs nothing on a no, and queues in the same write a turn told it was denied, with the note', async () => {
    const { bot, approval, decide, effects } = setup();
    await decide('deny', 'Use the staging host');
    expect(approval).toMatchObject({ status: 'denied', note: 'Use the staging host' });
    const { runCall, continuation } = effects();
    expect(runCall).toBeUndefined();
    expect(continuation?.turn).toMatchObject({
      status: 'queued',
      botId: bot.id,
      requestedByUserId: scope.userId,
      timeZone: 'Europe/Madrid',
      credentialScopes: null,
    });
    expect(continuation?.opening).toMatchObject({
      role: 'event',
      event: { kind: 'approval', outcome: 'denied', tool: 'start_session' },
      content:
        'Ana denied: Start Claude Code on build-02 in acme/xrp: Fix the test\nTheir note: Use the staging host',
    });
  });

  it('gives a denial’s turn only what both the asking turn and the decider may do', async () => {
    const { decide, effects } = setup({ askedWith: ['sessions:write', 'bots:write'] });
    await decide('deny', null, ['bots:write']);
    expect(effects().continuation?.turn.credentialScopes).toEqual(['bots:read', 'bots:write']);
  });

  it('refuses a decision that lost the write with BOTS_016, announcing nothing', async () => {
    const { stream, decide } = setup({ loses: true });
    await expect(decide('approve')).rejects.toMatchObject({ code: 'BOTS_016' });
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('refuses a card already decided with BOTS_016, writing nothing', async () => {
    const { approvals, decide } = setup({ decided: true });
    await expect(decide('deny')).rejects.toMatchObject({ code: 'BOTS_016' });
    expect(approvals.saveTransition).not.toHaveBeenCalled();
  });

  it('answers BOTS_015 for an approval that is not this bot’s', async () => {
    const { approvals, decide } = setup();
    approvals.findOne.mockResolvedValueOnce(None);
    await expect(decide('approve')).rejects.toMatchObject({ code: 'BOTS_015' });
  });

  it('leaves nothing standing for a yes to this call only', async () => {
    const { decide, effects } = setup();
    await decide('approve');
    expect(effects().standing).toBeUndefined();
  });

  it('sets the tool to Allow with an “Always allow”, written with the decision', async () => {
    const { approval, decide, effects } = setup();
    await decide('approve', null, null, 'tool');
    expect(approval.reach).toBe('tool');
    const { permission, maxGrants } = effects().standing ?? {};
    expect(maxGrants).toBe(100);
    expect(permission?.getProps()).toMatchObject({
      botId: approval.botId,
      tool: 'start_session',
      decision: 'allow',
      subject: null,
      createdByUserId: scope.userId,
    });
  });

  it('grants the tool on the card’s subject with an “Always allow for …”', async () => {
    const { decide, effects } = setup();
    await decide('approve', null, null, 'subject');
    expect(effects().standing?.permission.getProps()).toMatchObject({
      tool: 'start_session',
      decision: 'allow',
      subject: { kind: 'project', key: 'p-1', label: 'XRP' },
    });
  });

  it('refuses a reach the card does not offer with BOTS_030, deciding nothing', async () => {
    const { approval, approvals, decide } = setup({ perCallOnly: true });
    await expect(decide('approve', null, null, 'tool')).rejects.toMatchObject({
      code: 'BOTS_030',
    });
    expect(approval.status).toBe('pending');
    expect(approvals.saveTransition).not.toHaveBeenCalled();
  });

  it('answers a card of questions and queues in the same write a turn told the answers', async () => {
    const { approval, decide, effects } = setup({ questions: true });
    await decide('answer', null, null, 'once', [{ picks: [1], other: null }]);
    expect(approval).toMatchObject({ status: 'answered', answers: [{ picks: [1], other: null }] });
    const { runCall, continuation } = effects();
    expect(runCall).toBeUndefined();
    expect(continuation?.opening).toMatchObject({
      role: 'event',
      event: {
        kind: 'approval',
        outcome: 'answered',
        tool: 'ask_user',
        answers: [{ question: 'Which repository?', answer: 'acme/api' }],
      },
    });
  });

  it('refuses a yes to questions, and answers to a call, with BOTS_035, writing nothing', async () => {
    const questions = setup({ questions: true });
    await expect(questions.decide('approve')).rejects.toMatchObject({ code: 'BOTS_035' });
    const call = setup();
    await expect(
      call.decide('answer', null, null, 'once', [{ picks: [0], other: null }]),
    ).rejects.toMatchObject({ code: 'BOTS_035' });
    expect(questions.approvals.saveTransition).not.toHaveBeenCalled();
    expect(call.approvals.saveTransition).not.toHaveBeenCalled();
  });

  it('refuses answers that do not fit the questions with BOTS_036, and the card stays', async () => {
    const { approval, approvals, decide } = setup({ questions: true });
    await expect(
      decide('answer', null, null, 'once', [{ picks: [3], other: null }]),
    ).rejects.toMatchObject({ code: 'BOTS_036', detail: 'Question 1 has 2 options' });
    expect(approval.status).toBe('pending');
    expect(approvals.saveTransition).not.toHaveBeenCalled();
  });
});
