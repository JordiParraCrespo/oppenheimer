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
 * shows it at once. A bot has one card waiting at most, an approval or
 * questions: while one waits, a second call is told to wait, and the
 * repository holds that if two race.
 */
@Injectable()
export class BotApprovalRequestFactory implements BotApprovalRequesterPort {
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async request(call: BotApprovalCall): Promise<BotApprovalRequestOutcome> {
    const approval = BotApprovalEntity.request(call);
    const stored = await this.approvals.insertPending(approval);
    if (stored !== 'inserted') return { status: 'waiting', summary: stored.waiting };
    await this.stream.publish(call.botId, {
      type: 'approval',
      approvalId: approval.id,
      status: 'pending',
    });
    return { status: 'requested', approvalId: approval.id };
  }
}
