import { Inject, Injectable } from '@nestjs/common';
import { BOT_APPROVAL_REPOSITORY, BOT_MESSAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../database/bot-approval.repository.port';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import { opensApprovalStarted } from '../domain/bot-approval.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * Whether a turn a yes opened (`25-bots.md` §5) still has something to say.
 * It is there so the bot says it is on it while the call runs; once the call
 * ran, the turn that reports it is queued too, and an "on it" after the
 * fact (or after the report, when that one ran first) only gets in the way.
 */
@Injectable()
export class BotApprovalStartedResolver {
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
  ) {}

  /** True when the turn opens on a yes whose call already ran: it ends without a word. */
  async overtaken(turn: BotTurnEntity): Promise<boolean> {
    if (turn.origin !== 'approval') return false;
    const opening = await this.messages.findOpening(turn.organizationId, turn.id);
    if (!opening || !opensApprovalStarted(opening)) return false;
    const event = opening.event;
    const approvalId = event?.kind === 'approval' ? event.approvalId : undefined;
    if (!approvalId) return false;
    const found = await this.approvals.findForRun(approvalId);
    return found.isSome() && !found.unwrap().running;
  }
}
