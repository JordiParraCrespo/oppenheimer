import { Inject, Logger } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CacheService } from '@oppenheimer/backend-cache';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotCompletionResolver } from '../../application/bot-completion.resolver';
import { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import { BOT_MESSAGE_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import {
  BOT_SUGGESTER_PROMPT,
  BOT_SUGGESTION_READ_MAX,
  composeSuggestionRequest,
  suggestionAnchor,
  suggestionText,
} from '../../domain/bot-suggestion.policy';
import { FindBotSuggestionQuery } from './find-bot-suggestion.query';

/** A suggestion answers one message of the bot's, which never changes: kept a day. */
const SUGGESTION_TTL_SECONDS = 24 * 60 * 60;
/** The composer waits this long for the model before it shows no suggestion. */
const SUGGESTION_TIMEOUT_MS = 20_000;

/**
 * The person's likely next message, for the composer to offer (Claude Code's
 * prompt suggestion), or null. There is none while a turn runs, when the
 * bot did not speak last, when the bot's provider has no credential, or when
 * the model saw no clear next step or failed.
 *
 * It is asked of the bot's own model, with no tools, and its spend is the
 * bot's (`suggestion` in `/usage`). The answer is kept per message it answers
 * (`bot-suggestion:` in the cache), so a chat opened again, or in a second
 * tab, asks once; a failure is not kept. A bot in another workspace is `BOTS_001`.
 */
@QueryHandler(FindBotSuggestionQuery)
export class FindBotSuggestionQueryHandler
  implements IQueryHandler<FindBotSuggestionQuery, string | null>
{
  private readonly logger = new Logger(FindBotSuggestionQueryHandler.name);

  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly access: BotModelAccessResolver,
    private readonly completions: BotCompletionResolver,
    private readonly cache: CacheService,
  ) {}

  async execute({ scope, botId }: FindBotSuggestionQuery): Promise<string | null> {
    const { organizationId, id } = await this.lookup.bot(scope, botId);
    if (await this.turns.findRunningIn(organizationId, id)) return null;
    // The console chat's own conversation: a channel's (Telegram, WhatsApp) is another person's.
    const recent = await this.messages.findConversation(scope, id, BOT_SUGGESTION_READ_MAX);
    const anchor = suggestionAnchor(recent);
    if (!anchor) return null;
    const key = `bot-suggestion:${organizationId}:${id}:${anchor.id}`;
    try {
      const kept = await this.cache.getOrSet(key, SUGGESTION_TTL_SECONDS, async () => {
        const target = await this.access.ownModel(organizationId, id, new Date());
        if (!target) return { text: null };
        const answer = await this.completions.complete(
          {
            ...target,
            systemPrompt: BOT_SUGGESTER_PROMPT,
            message: composeSuggestionRequest(recent),
            signal: AbortSignal.timeout(SUGGESTION_TIMEOUT_MS),
          },
          { organizationId, botId: id, purpose: 'suggestion' },
        );
        return { text: suggestionText(answer) };
      });
      return kept.text;
    } catch (error) {
      this.logger.warn({
        message: 'No suggestion for the composer',
        botId: id,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
