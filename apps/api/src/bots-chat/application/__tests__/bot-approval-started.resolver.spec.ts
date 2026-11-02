import { randomUUID } from 'node:crypto';
import { None, Some } from 'oxide.ts';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { BotApprovalStartedResolver } from '../bot-approval-started.resolver';

/**
 * Whether the turn a yes opens still has an "on it" to say: only while the
 * approved call runs. Once it ran, the report's turn says it all, so the
 * turn ends without a word, whichever of the two the queue ran first.
 */
function setup(options: {
  origin?: 'approval' | 'message';
  stage?: 'started' | 'finished';
  /** The approval as the worker reads it: still running, ran, or gone. */
  approval?: 'running' | 'ran' | 'gone';
}) {
  const turn = BotTurnEntity.queue({
    organizationId: randomUUID(),
    botId: randomUUID(),
    requestedByUserId: randomUUID(),
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    origin: options.origin ?? 'approval',
  });
  const opening = BotMessageEntity.createNew({
    organizationId: turn.organizationId,
    botId: turn.botId,
    turnId: turn.id,
    role: 'event',
    content: 'Ana approved: Archive 25 threads\nIt is running now.',
    event: {
      kind: 'approval',
      outcome: 'approved',
      tool: 'archive_mail',
      summary: 'Archive 25 threads',
      sessionId: null,
      approvalId: 'a-1',
      ...(options.stage && { stage: options.stage }),
    },
    steps: [],
    position: 0,
  });
  const approvals = {
    findForRun: vi.fn(async () =>
      options.approval === 'gone'
        ? None
        : Some({ running: options.approval !== 'ran' } as BotApprovalEntity),
    ),
  } satisfies Pick<BotApprovalRepositoryPort, 'findForRun'>;
  const resolver = new BotApprovalStartedResolver(
    { findOpening: async () => opening } as unknown as BotMessageRepositoryPort,
    approvals as unknown as BotApprovalRepositoryPort,
  );
  return { overtaken: () => resolver.overtaken(turn), approvals };
}

describe('BotApprovalStartedResolver', () => {
  it('lets the turn a yes opened speak while the call runs', async () => {
    await expect(setup({ stage: 'started', approval: 'running' }).overtaken()).resolves.toBe(false);
  });

  // Regression: "On it" written after the call ran, or under its report.
  it('ends it without a word once the call ran', async () => {
    const { overtaken, approvals } = setup({ stage: 'started', approval: 'ran' });
    await expect(overtaken()).resolves.toBe(true);
    expect(approvals.findForRun).toHaveBeenCalledWith('a-1');
  });

  it('never silences the report, a turn of yours, or a card that is gone', async () => {
    const report = setup({ stage: 'finished', approval: 'ran' });
    await expect(report.overtaken()).resolves.toBe(false);
    expect(report.approvals.findForRun).not.toHaveBeenCalled();
    await expect(setup({ origin: 'message', stage: 'started' }).overtaken()).resolves.toBe(false);
    await expect(setup({ stage: 'started', approval: 'gone' }).overtaken()).resolves.toBe(false);
  });
});
