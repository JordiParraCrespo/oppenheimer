import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_QUESTION_REPOSITORY,
  BOT_STREAM,
} from '../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../database/bot-approval.repository.port';
import type { BotQuestionRepositoryPort } from '../database/bot-question.repository.port';
import { approvalResolved } from '../domain/bot-approval.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';

/**
 * The card a bot has waiting, of either kind: an approval or a card of
 * questions (`25-bots.md` §5). Writing to the bot instead of answering it
 * retires it: the new turn starts fresh, and nobody decided. A decision that
 * lands first wins, and this does nothing.
 */
@Injectable()
export class BotWaitingCardResolver {
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_QUESTION_REPOSITORY) private readonly questions: BotQuestionRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async retire(organizationId: string, botId: string): Promise<void> {
    const now = new Date();
    const approval = await this.approvals.findPending(organizationId, botId);
    if (approval.isSome()) {
      const card = approval.unwrap();
      card.expire(now);
      if (await this.approvals.saveTransition(card)) {
        await this.stream.publish(botId, {
          type: 'approval',
          approvalId: card.id,
          status: 'expired',
        });
        await this.stream.publish(botId, approvalResolved(card, 'expired'));
      }
    }
    const question = await this.questions.findPending(organizationId, botId);
    if (question.isSome()) {
      const card = question.unwrap();
      card.expire(now);
      if (await this.questions.saveTransition(card)) {
        await this.stream.publish(botId, {
          type: 'question',
          questionId: card.id,
          status: 'expired',
        });
      }
    }
  }
}
