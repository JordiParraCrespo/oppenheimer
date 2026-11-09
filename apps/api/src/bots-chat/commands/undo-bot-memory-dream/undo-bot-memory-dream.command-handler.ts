import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_MEMORY_FACTS_MAX } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import {
  BOT_MEMORY_DREAM_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_STREAM,
} from '../../bots-chat.di-tokens';
import type { BotMemoryDreamRepositoryPort } from '../../database/bot-memory-dream.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { dreamLine, undoLineId } from '../../domain/bot-dream.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { UndoBotMemoryDreamCommand } from './undo-bot-memory-dream.command';

/**
 * Undoes the bot's latest dream (`25-bots.md` §4.1, "Dreaming"): the facts
 * it replaced come back as they were, the ones it wrote go, and what the bot
 * saved since stays. `BOTS_041` when there is no dream to undo, or it was
 * undone already. The chat says so, and the bot reads it.
 */
@CommandHandler(UndoBotMemoryDreamCommand)
export class UndoBotMemoryDreamCommandHandler
  implements ICommandHandler<UndoBotMemoryDreamCommand, AggregateID>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_MEMORY_DREAM_REPOSITORY) private readonly dreams: BotMemoryDreamRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async execute({ scope, botId }: UndoBotMemoryDreamCommand): Promise<AggregateID> {
    const bot = await this.lookup.bot(scope, botId);
    const undone = await this.dreams.undo(bot.organizationId, bot.id, BOT_MEMORY_FACTS_MAX);
    if (!undone) {
      throw new AppError(BotErrors.DREAM_NOT_FOUND, {
        detail: `Bot ${bot.id} has no dream to undo`,
      });
    }
    const line = dreamLine({
      id: undoLineId(undone.id),
      organizationId: bot.organizationId,
      botId: bot.id,
      activity: 'undone',
      factsBefore: undone.factsBefore,
      factsAfter: undone.factsAfter,
      note: null,
      at: undone.undoneAt ?? new Date(),
    });
    if (await this.messages.insertOnce(line)) {
      await this.stream.publish(bot.id, { type: 'message', turnId: null, messageId: line.id });
    }
    return undone.id;
  }
}
