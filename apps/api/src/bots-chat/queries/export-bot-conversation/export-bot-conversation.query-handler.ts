import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_MESSAGE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import { ExportBotConversationQuery } from './export-bot-conversation.query';

/** How many messages one read of the export holds in memory. */
export const EXPORT_PAGE_SIZE = 500;

/**
 * Export (Settings → Profile): the whole chat, oldest first, as pages read
 * one after another while the response is written, so a long conversation is
 * never held in memory at once. The bot is looked up first, so a bot the
 * caller cannot see answers 404 before anything is sent.
 */
@QueryHandler(ExportBotConversationQuery)
export class ExportBotConversationQueryHandler
  implements IQueryHandler<ExportBotConversationQuery, AsyncIterable<BotMessageEntity[]>>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
  ) {}

  async execute({
    scope,
    botId,
  }: ExportBotConversationQuery): Promise<AsyncIterable<BotMessageEntity[]>> {
    await this.lookup.bot(scope, botId);
    return this.pages(scope, botId);
  }

  private async *pages(scope: AccessScope, botId: string): AsyncIterable<BotMessageEntity[]> {
    let after: BotMessageEntity | null = null;
    while (true) {
      const page = await this.messages.findExportPage(scope, botId, after, EXPORT_PAGE_SIZE);
      if (page.length > 0) yield page;
      if (page.length < EXPORT_PAGE_SIZE) return;
      after = page[page.length - 1] ?? null;
    }
  }
}
