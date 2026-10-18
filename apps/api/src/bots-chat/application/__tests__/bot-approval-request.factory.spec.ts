import { None, Some } from 'oxide.ts';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import { BotApprovalEntity } from '../../domain/bot-approval.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { BotApprovalExpiryResolver } from '../bot-approval-expiry.resolver';
import { BotApprovalRequestFactory } from '../bot-approval-request.factory';

/**
 * Raising a Needs input card (`25-bots.md` §5): one waits per bot, so a
 * second call is told to wait for it, unless that card is past its time, in
 * which case it expires (and the chat is told) and the new card goes up with
 * its tool's window. The database's half of one-at-a-time is the
 * integration suite's.
 */
const CALL = {
  organizationId: 'org-1',
  botId: 'bot-1',
  turnId: 'turn-2',
  tool: 'delete_bot',
  input: { bot_id: 'b-2', name: 'Grace' },
  summary: 'Delete bot "Grace" for good',
};

function setup(waiting: BotApprovalEntity | null) {
  const approvals = {
    findPending: vi.fn(async () => (waiting ? Some(waiting) : None)),
    insertPending: vi.fn(async (_approval: BotApprovalEntity) => 'inserted' as const),
    saveTransition: vi.fn(async () => true),
  };
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const port = approvals as unknown as BotApprovalRepositoryPort;
  const factory = new BotApprovalRequestFactory(
    port,
    stream,
    new BotApprovalExpiryResolver(port, stream),
  );
  return { approvals, stream, factory };
}

function earlier(raisedAt: Date) {
  return BotApprovalEntity.request(
    { ...CALL, turnId: 'turn-1', tool: 'start_session', input: {}, summary: 'Start it' },
    raisedAt,
  );
}

describe('BotApprovalRequestFactory', () => {
  it('raises a card with its tool’s window and announces it', async () => {
    const { approvals, stream, factory } = setup(null);
    const before = Date.now();
    const outcome = await factory.request({ ...CALL, ttlMs: 60_000 });
    const raised = approvals.insertPending.mock.calls[0][0];
    expect(outcome).toEqual({ status: 'requested', approvalId: raised.id });
    expect(raised.expiresAt.getTime() - before).toBeGreaterThanOrEqual(60_000);
    expect(raised.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'approval',
      approvalId: raised.id,
      status: 'pending',
    });
  });

  it('tells a second call to wait while the first card is still in time, raising nothing', async () => {
    const { approvals, factory } = setup(earlier(new Date()));
    expect(await factory.request(CALL)).toEqual({ status: 'waiting', summary: 'Start it' });
    expect(approvals.insertPending).not.toHaveBeenCalled();
    expect(approvals.saveTransition).not.toHaveBeenCalled();
  });

  it('expires a card past its time, telling the chat, and raises the new one', async () => {
    const stale = earlier(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    const { approvals, stream, factory } = setup(stale);
    const outcome = await factory.request(CALL);
    expect(stale.status).toBe('expired');
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'approval',
      approvalId: stale.id,
      status: 'expired',
    });
    expect(outcome.status).toBe('requested');
    expect(approvals.insertPending).toHaveBeenCalledTimes(1);
  });
});
