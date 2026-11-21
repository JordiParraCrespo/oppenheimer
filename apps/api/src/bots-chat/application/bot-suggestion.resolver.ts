import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import {
  BOT_SUGGESTER_PROMPT,
  composeSuggestionRequest,
  type SuggestionMessage,
  suggestionText,
} from '../domain/bot-suggestion.policy';
import { BotCompletionResolver } from './bot-completion.resolver';
import { BotModelAccessResolver } from './bot-model-access.resolver';

/** A suggestion answers one message of the bot's, which never changes: kept a day. */
const SUGGESTION_TTL_SECONDS = 24 * 60 * 60;
/** The composer waits this long for the model before it shows no suggestion. */
const SUGGESTION_TIMEOUT_MS = 20_000;

/**
 * The one place a suggestion costs anything: the call to the bot's own
 * model, with no tools, whose spend `BotCompletionResolver` records against
 * the bot (`suggestion` in `/usage`). The answer is kept per message it
 * answers (`bot-suggestion:` in the cache), so asking again for the same
 * message spends nothing; a failure is logged, not kept, and is no
 * suggestion. A bot whose provider has no credential gets none.
 */
@Injectable()
export class BotSuggestionResolver {
  private readonly logger = new Logger(BotSuggestionResolver.name);

  constructor(
    private readonly access: BotModelAccessResolver,
    private readonly completions: BotCompletionResolver,
    private readonly cache: CacheService,
  ) {}

  /** The suggestion answering `anchor`, the bot's last message in `messages`. */
  async suggest(
    bot: { organizationId: string; id: string },
    messages: readonly SuggestionMessage[],
    anchor: SuggestionMessage,
  ): Promise<string | null> {
    const key = `bot-suggestion:${bot.organizationId}:${bot.id}:${anchor.id}`;
    try {
      const kept = await this.cache.getOrSet(key, SUGGESTION_TTL_SECONDS, async () => ({
        text: await this.ask(bot, messages),
      }));
      return kept.text;
    } catch (error) {
      this.logger.warn({
        message: 'No suggestion for the composer',
        botId: bot.id,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async ask(
    { organizationId, id }: { organizationId: string; id: string },
    messages: readonly SuggestionMessage[],
  ): Promise<string | null> {
    const target = await this.access.ownModel(organizationId, id, new Date());
    if (!target) return null;
    const answer = await this.completions.complete(
      {
        ...target,
        systemPrompt: BOT_SUGGESTER_PROMPT,
        message: composeSuggestionRequest(messages),
        signal: AbortSignal.timeout(SUGGESTION_TIMEOUT_MS),
      },
      { organizationId, botId: id, purpose: 'suggestion' },
    );
    return suggestionText(answer);
  }
}
