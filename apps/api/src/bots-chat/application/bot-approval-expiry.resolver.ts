import { Inject, Injectable } from '@nestjs/common';
import { BOT_APPROVAL_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../database/bot-approval.repository.port';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';

/**
 * A card past its `expiresAt` (`25-bots.md` §5) is expired the first time
 * anyone looks: a decision on it, or the bot asking again. Nothing sweeps
 * them; a card nobody looks at again goes with its bot. The move is the same
 * conditional write as a decision, so a yes that landed first wins.
 */
@Injectable()
export class BotApprovalExpiryResolver {
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  /** Whether the card was past its time; when it was and this write won, the chat is told. */
  async retire(approval: BotApprovalEntity, now: Date): Promise<boolean> {
    if (!approval.isExpiredAt(now)) return false;
    approval.expire(now);
    if (await this.approvals.saveTransition(approval)) {
      await this.stream.publish(approval.botId, {
        type: 'approval',
        approvalId: approval.id,
        status: 'expired',
      });
    }
    return true;
  }
}
