import { Inject, Injectable } from '@nestjs/common';
import { BOT_APPROVAL_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../database/bot-approval.repository.port';
import { BotApprovalEntity } from '../domain/bot-approval.entity';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import type {
  BotApprovalCall,
  BotApprovalRequesterPort,
  BotApprovalRequestOutcome,
} from './bot-approval-requester.port';

/**
 * Raises Needs input cards (`25-bots.md` §5): an asking tool's call, stored
 * as a pending approval and announced on the bot's stream so an open chat
 * shows it at once. A bot has one card waiting at most: while one waits, a
 * second call is told to wait, and the database holds that if two race.
 */
@Injectable()
export class BotApprovalRequestFactory implements BotApprovalRequesterPort {
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async request(call: BotApprovalCall): Promise<BotApprovalRequestOutcome> {
    const waiting = await this.approvals.findPending(call.organizationId, call.botId);
    if (waiting.isSome()) return { status: 'waiting', summary: waiting.unwrap().summary };
    const approval = BotApprovalEntity.request(call);
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
