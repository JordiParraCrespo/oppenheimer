import { emptyScope } from '@oppenheimer/backend-authz';
import type { Scope } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { z } from 'zod/v4';
import type { BotRepositoryPort } from '../../../../bots/database/bot.repository.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import { BotApprovedCallResolver } from '../../../application/bot-approved-call.resolver';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
import { type BotToolArea, defineBotTool } from '../../../application/bot-tool.factory';
import { BotToolboxFactory } from '../../../application/bot-toolbox.factory';
import type {
  BotApprovalEffects,
  BotApprovalRepositoryPort,
} from '../../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotApprovalEntity } from '../../../domain/bot-approval.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { RunApprovedCallCommand } from '../run-approved-call.command';
import { RunApprovedCallCommandHandler } from '../run-approved-call.command-handler';

/**
 * Carrying out an approved call, through the real resolver and toolbox over a
 * stand-in `start_session`. It runs exactly the stored input, as the owner,
 * keyed by the approval, only when both the asking turn's and the deciding
 * credential's scopes cover the tool; the answer and the turn that reports it
 * are one write, and that turn gets the same intersection. A token limited to
 * `bots:write` approving a card raised in the browser runs nothing. A job
 * retried after the result landed does nothing.
 */
const OWNER = 'owner-1';

function setup(
  options: {
    askedWith?: readonly Scope[] | null;
    decidedWith?: readonly Scope[] | null;
    alreadyRan?: boolean;
    fails?: boolean;
  } = {},
) {
  const bot = BotEntity.createNew({
    organizationId: 'org-1',
    createdByUserId: OWNER,
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
    requestedByUserId: OWNER,
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    timeZone: 'Europe/Madrid',
    credentialScopes: options.askedWith ?? null,
  });
  const approval = BotApprovalEntity.request({
    organizationId: bot.organizationId,
    botId: bot.id,
    turnId: asked.id,
    tool: 'start_session',
    input: { task: 'Fix the test' },
    summary: 'Start Claude Code on build-02: Fix the test',
  });
  approval.approve(OWNER, new Date(), options.decidedWith ?? null);
  approval.markPersisted();
  if (options.alreadyRan) approval.recordResult('Started session s-0.', false);

  const run = vi.fn(async (input: { task: string }) => {
    if (options.fails) throw new Error('boom');
    return `Started session for ${input.task}.`;
  });
  const area: BotToolArea = {
    definitions: () => [
      defineBotTool({
        name: 'start_session',
        scope: 'sessions:write',
        asks: true,
        description: 'Starts a session.',
        input: z.object({ task: z.string() }),
        run,
      }),
    ],
  };
  const none: BotToolArea = { definitions: () => [] };
  const toolbox = new (
    BotToolboxFactory as unknown as new (
      ...areas: BotToolArea[]
    ) => BotToolboxFactory
  )(area, none, none, none, none, none, none, none, none);
  const owners = {
    resolve: vi.fn(async () => emptyScope(OWNER, 'org-1')),
  } as unknown as BotOwnerScopeResolver;

  const approvals = {
    findForRun: vi.fn(async () => Some(approval)),
    saveTransition: vi.fn(
      async (_approval: BotApprovalEntity, _effects?: BotApprovalEffects) => true,
    ),
  } satisfies Partial<BotApprovalRepositoryPort>;
  const bots = { findForTurn: vi.fn(async () => Some(bot)) } satisfies Partial<BotRepositoryPort>;
  const turns = {
    findForRun: vi.fn(async () => Some(asked)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const handler = new RunApprovedCallCommandHandler(
    approvals as unknown as BotApprovalRepositoryPort,
    bots as unknown as BotRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
    new BotApprovedCallResolver(owners, toolbox),
  );
  const execute = () =>
    handler.execute(new RunApprovedCallCommand({ approvalId: approval.id, by: 'Ana' }));
  const effects = () => approvals.saveTransition.mock.calls[0]?.[1] as BotApprovalEffects;
  return { approval, approvals, turns, run, stream, execute, effects };
}

describe('RunApprovedCallCommandHandler', () => {
  it('runs exactly the stored call, keyed by the approval, and reports it in the same write', async () => {
    const { approval, run, execute, effects } = setup();
    await execute();
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toEqual({ task: 'Fix the test' });
    expect(run.mock.calls[0][1]).toMatchObject({
      approvalId: approval.id,
      owner: { userId: OWNER },
    });
    expect(approval).toMatchObject({
      status: 'approved',
      result: 'Started session for Fix the test.',
    });
    const { continuation } = effects();
    expect(continuation?.turn).toMatchObject({
      requestedByUserId: OWNER,
      timeZone: 'Europe/Madrid',
      credentialScopes: null,
    });
    expect(continuation?.opening).toMatchObject({
      role: 'event',
      event: { outcome: 'approved', tool: 'start_session' },
      content:
        'Ana approved: Start Claude Code on build-02: Fix the test\nIt ran: Started session for Fix the test.',
    });
  });

  it('runs nothing when a bots:write token approves a card raised in the browser, and the report gets bots:write only', async () => {
    const { approval, run, execute, effects } = setup({ decidedWith: ['bots:write'] });
    await execute();
    expect(run).not.toHaveBeenCalled();
    expect(approval).toMatchObject({
      status: 'failed',
      result: 'Not run: your credential does not cover sessions:write.',
    });
    expect(effects().continuation?.turn.credentialScopes).toEqual(['bots:write']);
    expect(effects().continuation?.opening.event).toMatchObject({ outcome: 'failed' });
  });

  it('runs nothing when the asking turn’s token did not cover the tool', async () => {
    const { run, approval, execute } = setup({ askedWith: ['bots:write'] });
    await execute();
    expect(run).not.toHaveBeenCalled();
    expect(approval.status).toBe('failed');
  });

  it('runs under a token that covers the tool on both sides', async () => {
    const { run, execute, effects } = setup({
      askedWith: ['sessions:write', 'bots:write'],
      decidedWith: ['sessions:write'],
    });
    await execute();
    expect(run).toHaveBeenCalledOnce();
    expect(effects().continuation?.turn.credentialScopes).toEqual([
      'sessions:read',
      'sessions:write',
    ]);
  });

  it('ends failed, and says so, when the call throws', async () => {
    const { approval, execute } = setup({ fails: true });
    await execute();
    expect(approval.status).toBe('failed');
  });

  it('does nothing when the job is retried after the result landed', async () => {
    const { run, approvals, stream, execute } = setup({ alreadyRan: true });
    await execute();
    expect(run).not.toHaveBeenCalled();
    expect(approvals.saveTransition).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('does nothing for an approval that is gone', async () => {
    const { approvals, run, execute } = setup();
    approvals.findForRun.mockResolvedValueOnce(None);
    await execute();
    expect(run).not.toHaveBeenCalled();
  });
});
