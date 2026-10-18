import { Inject, Injectable } from '@nestjs/common';
import { BOT_APPROVAL_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../database/bot-approval.repository.port';
import { BotApprovalEntity } from '../domain/bot-approval.entity';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { BotApprovalExpiryResolver } from './bot-approval-expiry.resolver';
import type {
  BotApprovalCall,
  BotApprovalRequesterPort,
  BotApprovalRequestOutcome,
} from './bot-approval-requester.port';

/**
 * Raises Needs input cards (`25-bots.md` §5): an asking tool's call, stored
 * as a pending approval and announced on the bot's stream so an open chat
 * shows it at once. A bot has one card waiting at most: while one waits, a
 * second call is told to wait, and the database holds that if two race. A
 * card waits for its tool's window (`ttlMs`, a day by default).
 */
@Injectable()
export class BotApprovalRequestFactory implements BotApprovalRequesterPort {
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly expiry: BotApprovalExpiryResolver,
  ) {}

  async request(call: BotApprovalCall): Promise<BotApprovalRequestOutcome> {
    const now = new Date();
    const waiting = await this.approvals.findPending(call.organizationId, call.botId);
    // A card past its time no longer holds the bot's one place: it expires, and this one is raised.
    if (waiting.isSome() && !(await this.expiry.retire(waiting.unwrap(), now))) {
      return { status: 'waiting', summary: waiting.unwrap().summary };
    }
    const { ttlMs, ...asked } = call;
    const approval = BotApprovalEntity.request(asked, now, ttlMs);
    if ((await this.approvals.insertPending(approval)) === 'pending_exists') {
      const raced = await this.approvals.findPending(call.organizationId, call.botId);
      return { status: 'waiting', summary: raced.isSome() ? raced.unwrap().summary : call.summary };
    }
    await this.stream.publish(call.botId, {
      type: 'approval',
      approvalId: approval.id,
      status: 'pending',
    });
    return { status: 'requested', approvalId: approval.id };
  }
}
