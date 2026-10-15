import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotEngine } from '@oppenheimer/backend-agents';
import {
  BotCompletionResolver,
  type BotCompletionTarget,
} from '../../application/bot-completion.resolver';
import {
  BOT_CONVERSATION_SUMMARY_REPOSITORY,
  BOT_ENGINE,
  BOT_MESSAGE_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotConversationSummaryRepositoryPort } from '../../database/bot-conversation-summary.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { BotConversationSummaryEntity } from '../../domain/bot-conversation-summary.entity';
import {
  BOT_SUMMARIZER_PROMPT,
  BOT_SUMMARY_READ_MAX,
  composeSummaryRequest,
  planSummary,
} from '../../domain/bot-summary.policy';
import { BOT_TURN_TIME_LIMIT_MS } from '../../domain/bot-turn.entity';
import { SummarizeBotConversationCommand } from './summarize-bot-conversation.command';

/**
 * Folds a bot's oldest uncovered messages into its conversation summary
 * (`25-bots.md` §2): reads the summary and what it does not cover, decides
 * again what to fold (a job staged twice folds once), asks the bot's own
 * model, with no tools, for the new summary, and stores it conditioned on
 * the version it read. A job that loses that race writes nothing: the other
 * one's summary stands. A conversation still past the threshold after a
 * fold stages the next one. A bot that is gone, or whose key cannot be
 * opened, is left as it is; a model that fails throws, and the queue retries.
 */
@CommandHandler(SummarizeBotConversationCommand)
export class SummarizeBotConversationCommandHandler
  implements ICommandHandler<SummarizeBotConversationCommand, void>
{
  private readonly logger = new Logger(SummarizeBotConversationCommandHandler.name);

  constructor(
    @Inject(BOT_CONVERSATION_SUMMARY_REPOSITORY)
    private readonly summaries: BotConversationSummaryRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_ENGINE) private readonly engine: BotEngine,
    private readonly targets: BotCompletionResolver,
  ) {}

  async execute({
    organizationId,
    botId,
    metadata,
  }: SummarizeBotConversationCommand): Promise<void> {
    const target = await this.targets.resolve(organizationId, botId);
    if (!target) return;
    const found = await this.summaries.findForBot(organizationId, botId);
    const summary = found.isSome() ? found.unwrap() : null;
    const uncovered = await this.messages.findUncovered(
      organizationId,
      botId,
      summary?.coversThroughMessageId ?? null,
      BOT_SUMMARY_READ_MAX,
    );
    const plan = planSummary(uncovered);
    if (!plan) return;

    const content = await this.complete(
      target,
      composeSummaryRequest(summary?.content ?? null, plan.fold),
    );
    if (!content) throw new Error(`The summary of bot ${botId} came back empty`);
    summary?.revise(content, plan.through);
    const next =
      summary ??
      BotConversationSummaryEntity.first({ organizationId, botId, content, through: plan.through });
    if (!(await this.summaries.save(next))) {
      this.logger.log({ message: 'Another job summarized the conversation first', botId });
      return;
    }
    if (uncovered.length >= BOT_SUMMARY_READ_MAX || planSummary(plan.rest)) {
      await this.summaries.stageSummarize(organizationId, botId, metadata.correlationId);
    }
  }

  /** One tool-less answer from the bot's model, in a scratch directory of its own. */
  private async complete(target: BotCompletionTarget, message: string): Promise<string> {
    const scratchDir = await mkdtemp(join(tmpdir(), 'bot-summary-'));
    try {
      return await this.engine.complete({
        ...target,
        systemPrompt: BOT_SUMMARIZER_PROMPT,
        message,
        signal: AbortSignal.timeout(BOT_TURN_TIME_LIMIT_MS),
        scratchDir,
      });
    } finally {
      await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
