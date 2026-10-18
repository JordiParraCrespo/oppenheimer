import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Scope } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotActorAbilityResolver } from '../../../application/bot-actor-ability.resolver';
import { BotApprovalExpiryResolver } from '../../../application/bot-approval-expiry.resolver';
import type { BotToolPolicy } from '../../../application/bot-tool.factory';
import type { BotToolboxFactory } from '../../../application/bot-toolbox.factory';
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
 * announces nothing. A card past its time is expired, not decided
 * (`BOTS_023`); a yes that names another call's digest (`BOTS_024`), or comes
 * from someone without the tool's role rule (`BOTS_025`), writes nothing. The
 * race is the integration suite's.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const DAY = 24 * 60 * 60 * 1000;

function setup(
  options: {
    decided?: boolean;
    loses?: boolean;
    askedWith?: readonly Scope[] | null;
    raisedAt?: Date;
    policy?: BotToolPolicy;
    mayDecide?: boolean;
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
  const approval = BotApprovalEntity.request(
    {
      organizationId: bot.organizationId,
      botId: bot.id,
      turnId: asked.id,
      tool: 'start_session',
      input: { task: 'Fix the test', project_id: 'p-1' },
      summary: 'Start Claude Code on build-02 in acme/xrp: Fix the test',
    },
    options.raisedAt ?? new Date(),
  );
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
  const abilities = { may: vi.fn(async () => options.mayDecide ?? true) };
  const handler = new DecideBotApprovalCommandHandler(
    { bot: async () => bot } as BotLookupPort,
    approvals as unknown as BotApprovalRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
    new BotApprovalExpiryResolver(approvals as unknown as BotApprovalRepositoryPort, stream),
    { policyOf: () => options.policy ?? null } as unknown as BotToolboxFactory,
    abilities as unknown as BotActorAbilityResolver,
  );
  const decide = (
    decision: 'approve' | 'deny',
    note: string | null = null,
    credentialScopes: readonly Scope[] | null = null,
    callDigest: string | null = decision === 'approve' ? approval.callDigest : null,
  ) =>
    handler.execute(
      new DecideBotApprovalCommand({
        scope,
        botId: bot.id,
        approvalId: approval.id,
        decision,
        note,
        deciderName: 'Ana',
        credentialScopes,
        callDigest,
      }),
    );
  const effects = () => approvals.saveTransition.mock.calls[0][1] as BotApprovalEffects;
  return { bot, approval, approvals, abilities, stream, decide, effects };
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

  it('expires a card past its time instead of deciding it, with BOTS_023, and runs nothing', async () => {
    const { approval, approvals, stream, decide } = setup({
      raisedAt: new Date(Date.now() - 2 * DAY),
    });
    await expect(decide('approve')).rejects.toMatchObject({ code: 'BOTS_023' });
    expect(approval).toMatchObject({ status: 'expired', decidedByUserId: null });
    expect(approvals.saveTransition).toHaveBeenCalledTimes(1);
    expect(approvals.saveTransition.mock.calls[0][1]).toBeUndefined();
    expect(stream.publish).toHaveBeenCalledWith(approval.botId, {
      type: 'approval',
      approvalId: approval.id,
      status: 'expired',
    });
  });

  it('refuses a yes naming another call, or none, with BOTS_024, writing nothing', async () => {
    const { approval, approvals, stream, decide } = setup();
    const other = 'f'.repeat(64);
    await expect(decide('approve', null, null, other)).rejects.toMatchObject({ code: 'BOTS_024' });
    await expect(decide('approve', null, null, null)).rejects.toMatchObject({ code: 'BOTS_024' });
    expect(approval.status).toBe('pending');
    expect(approvals.saveTransition).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('refuses a yes from someone without the tool’s role rule with BOTS_025, but lets them say no', async () => {
    const policy = { action: 'delete', subject: 'Bot' };
    const { bot, approval, approvals, abilities, decide } = setup({ policy, mayDecide: false });
    await expect(decide('approve')).rejects.toMatchObject({ code: 'BOTS_025' });
    expect(abilities.may).toHaveBeenCalledWith(bot.organizationId, scope.userId, policy);
    expect(approvals.saveTransition).not.toHaveBeenCalled();
    await decide('deny');
    expect(approval.status).toBe('denied');
  });

  it('answers BOTS_015 for an approval that is not this bot’s', async () => {
    const { approvals, decide } = setup();
    approvals.findOne.mockResolvedValueOnce(None);
    await expect(decide('approve')).rejects.toMatchObject({ code: 'BOTS_015' });
  });
});
