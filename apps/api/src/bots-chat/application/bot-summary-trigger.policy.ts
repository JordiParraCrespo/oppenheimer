import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BOT_CONVERSATION_SUMMARY_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
} from '../bots-chat.di-tokens';
import type { BotConversationSummaryRepositoryPort } from '../database/bot-conversation-summary.repository.port';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import { BOT_SUMMARY_READ_MAX, planSummary } from '../domain/bot-summary.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * After a turn ends (`25-bots.md` §2): whether the bot's messages the summary
 * does not cover have passed the threshold, and if so a job that folds the
 * oldest of them into it. The decision is `planSummary`'s; the job decides
 * again on what it reads, so a job staged twice folds once. The turn has
 * already ended when this runs, so a failure here is logged and nothing more:
 * the next turn's end asks again.
 */
@Injectable()
export class BotSummaryTriggerPolicy {
  private readonly logger = new Logger(BotSummaryTriggerPolicy.name);

  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_CONVERSATION_SUMMARY_REPOSITORY)
    private readonly summaries: BotConversationSummaryRepositoryPort,
  ) {}

  /** Whether a summarizing job was staged. */
  async afterTurn(turn: BotTurnEntity, correlationId: string | null): Promise<boolean> {
    try {
      const summary = await this.summaries.findForBot(turn.organizationId, turn.botId);
      const uncovered = await this.messages.findUncovered(
        turn.organizationId,
        turn.botId,
        summary.isSome() ? summary.unwrap().coversThroughMessageId : null,
        BOT_SUMMARY_READ_MAX,
      );
      if (!planSummary(uncovered)) return false;
      await this.summaries.stageSummarize(turn.organizationId, turn.botId, correlationId);
      return true;
    } catch (error) {
      this.logger.warn({
        message: 'Could not decide whether a bot conversation needs summarizing',
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
