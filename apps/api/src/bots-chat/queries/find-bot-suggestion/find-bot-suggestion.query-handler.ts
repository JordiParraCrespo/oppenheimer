import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotSuggestionResolver } from '../../application/bot-suggestion.resolver';
import { BOT_MESSAGE_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BOT_SUGGESTION_READ_MAX, suggestionAnchor } from '../../domain/bot-suggestion.policy';
import { FindBotSuggestionQuery } from './find-bot-suggestion.query';

/**
 * The person's likely next message, for the composer to offer (Claude Code's
 * prompt suggestion), or null. There is none while a turn runs, or when the
 * bot did not speak last in the console chat; otherwise the answer is
 * `BotSuggestionResolver`'s, the one place a suggestion spends. A bot in
 * another workspace is `BOTS_001`.
 */
@QueryHandler(FindBotSuggestionQuery)
export class FindBotSuggestionQueryHandler
  implements IQueryHandler<FindBotSuggestionQuery, string | null>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly suggestions: BotSuggestionResolver,
  ) {}

  async execute({ scope, botId }: FindBotSuggestionQuery): Promise<string | null> {
    const bot = await this.lookup.bot(scope, botId);
    if (await this.turns.findRunningIn(bot.organizationId, bot.id)) return null;
    // The console chat's own conversation: a channel's (Telegram, WhatsApp) is another person's.
    const recent = await this.messages.findConversation(scope, bot.id, BOT_SUGGESTION_READ_MAX);
    const anchor = suggestionAnchor(recent);
    return anchor ? this.suggestions.suggest(bot, recent, anchor) : null;
  }
}
