import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotApprovedCallResolver } from '../../../application/bot-approved-call.resolver';
import type { BotApprovalRepositoryPort } from '../../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotApprovalEntity } from '../../../domain/bot-approval.entity';
import type { BotMessageEntity } from '../../../domain/bot-message.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { DecideBotApprovalCommand } from '../decide-bot-approval.command';
import { DecideBotApprovalCommandHandler } from '../decide-bot-approval.command-handler';

/**
 * Answering a Needs input card (`25-bots.md` §5). A yes runs exactly the
 * stored call, through the resolver that runs it as the owner, keeps its
 * answer, and queues a turn opened by an event saying who approved what and
 * what it answered; a no runs nothing and queues a turn saying it was denied,
 * with the note. A decision that loses the conditional write, or arrives on a
 * card already decided, is `BOTS_016` and does nothing else. What the run
 * does as the owner is the tool framework's spec; the race is the
 * integration suite's.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup(options: { decided?: boolean; loses?: boolean; failed?: boolean } = {}) {
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
  });
  const approval = BotApprovalEntity.request({
    organizationId: bot.organizationId,
    botId: bot.id,
    turnId: asked.id,
    tool: 'start_session',
    input: { task: 'Fix the test', project_id: 'p-1' },
    summary: 'Start Claude Code on build-02 in acme/xrp: Fix the test',
  });
  if (options.decided) approval.expire(new Date());
  const approvals = {
    findOne: vi.fn(async () => Some(approval)),
    saveTransition: vi.fn(async () => !options.loses),
  } satisfies Partial<BotApprovalRepositoryPort>;
  const turns = {
    findOne: vi.fn(async () => Some(asked)),
    enqueue: vi.fn(async () => 'waiting' as const),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const calls = {
    resolve: vi.fn(async () => ({
      content: options.failed ? 'SESSIONS_004: Host not found.' : 'Started session s-1.',
      isError: options.failed === true,
    })),
  };
  const handler = new DecideBotApprovalCommandHandler(
    { bot: async () => bot } as BotLookupPort,
    approvals as unknown as BotApprovalRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
    calls as unknown as BotApprovedCallResolver,
  );
  const decide = (decision: 'approve' | 'deny', note: string | null = null) =>
    handler.execute(
      new DecideBotApprovalCommand({
        scope,
        botId: bot.id,
        approvalId: approval.id,
        decision,
        note,
        deciderName: 'Ana',
      }),
    );
  const continuation = () => {
    const [turn, opening] = turns.enqueue.mock.calls[0] as unknown as [
      BotTurnEntity,
      BotMessageEntity,
    ];
    return { turn, opening };
  };
  return { bot, approval, approvals, turns, calls, stream, decide, continuation };
}

describe('DecideBotApprovalCommandHandler', () => {
  it('runs exactly the stored call on a yes, keeps its answer, and queues a turn that reports it', async () => {
    const { bot, approval, approvals, calls, decide, continuation } = setup();
    await decide('approve');
    expect(calls.resolve).toHaveBeenCalledWith(bot, approval, 'Europe/Madrid');
    expect(approval).toMatchObject({
      status: 'approved',
      decidedByUserId: scope.userId,
      result: 'Started session s-1.',
      input: { task: 'Fix the test', project_id: 'p-1' },
    });
    expect(approvals.saveTransition).toHaveBeenCalledTimes(2);
    const { turn, opening } = continuation();
    expect(turn).toMatchObject({
      status: 'queued',
      botId: bot.id,
      requestedByUserId: scope.userId,
      provider: 'glm',
      model: 'glm-5.3',
      timeZone: 'Europe/Madrid',
    });
    expect(opening).toMatchObject({
      role: 'event',
      position: 0,
      turnId: turn.id,
      content:
        'Ana approved: Start Claude Code on build-02 in acme/xrp: Fix the test\nIt ran: Started session s-1.',
    });
  });

  it('ends the approval failed when the call failed, and tells the bot so', async () => {
    const { approval, decide, continuation } = setup({ failed: true });
    await decide('approve');
    expect(approval.status).toBe('failed');
    expect(continuation().opening.content).toContain(
      'It ran and failed: SESSIONS_004: Host not found.',
    );
  });

  it('runs nothing on a no, and queues a turn saying it was denied, with the note', async () => {
    const { approval, calls, decide, continuation } = setup();
    await decide('deny', 'Use the staging host');
    expect(calls.resolve).not.toHaveBeenCalled();
    expect(approval).toMatchObject({ status: 'denied', note: 'Use the staging host' });
    expect(continuation().opening.content).toBe(
      'Ana denied: Start Claude Code on build-02 in acme/xrp: Fix the test\nTheir note: Use the staging host',
    );
  });

  it('refuses a second decision that lost the write with BOTS_016, running and queuing nothing', async () => {
    const { calls, turns, stream, decide } = setup({ loses: true });
    await expect(decide('approve')).rejects.toMatchObject({ code: 'BOTS_016' });
    expect(calls.resolve).not.toHaveBeenCalled();
    expect(turns.enqueue).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('refuses a card already decided with BOTS_016, writing nothing', async () => {
    const { approvals, turns, decide } = setup({ decided: true });
    await expect(decide('deny')).rejects.toMatchObject({ code: 'BOTS_016' });
    expect(approvals.saveTransition).not.toHaveBeenCalled();
    expect(turns.enqueue).not.toHaveBeenCalled();
  });

  it('answers BOTS_015 for an approval that is not this bot’s', async () => {
    const { approvals, decide } = setup();
    approvals.findOne.mockResolvedValueOnce(None);
    await expect(decide('approve')).rejects.toMatchObject({ code: 'BOTS_015' });
  });
});
