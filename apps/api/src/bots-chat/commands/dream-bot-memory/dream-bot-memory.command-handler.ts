import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BOT_MEMORY_FACTS_MAX } from '@oppenheimer/shared';
import { BotDreamResolver } from '../../application/bot-dream.resolver';
import {
  BOT_MEMORY_DREAM_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_STREAM,
} from '../../bots-chat.di-tokens';
import type { BotMemoryDreamRepositoryPort } from '../../database/bot-memory-dream.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { dreamLine } from '../../domain/bot-dream.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { DreamBotMemoryCommand } from './dream-bot-memory.command';

/**
 * A bot's dream (`25-bots.md` §4.1, "Dreaming"): what `BotDreamResolver`
 * says to write replaces the facts it read, in one write that is refused
 * when any of them changed meanwhile (the bot saved, the owner edited): the
 * dream read a memory that is gone, and the next one reads it again. A dream
 * that wrote says so in the chat, a line outside any turn that the bot reads
 * back like any note from Oppenheimer.
 */
@CommandHandler(DreamBotMemoryCommand)
export class DreamBotMemoryCommandHandler implements ICommandHandler<DreamBotMemoryCommand, void> {
  private readonly logger = new Logger(DreamBotMemoryCommandHandler.name);

  constructor(
    private readonly dreamer: BotDreamResolver,
    @Inject(BOT_MEMORY_DREAM_REPOSITORY) private readonly dreams: BotMemoryDreamRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async execute({ organizationId, botId, force }: DreamBotMemoryCommand): Promise<void> {
    try {
      await this.dreamOnce(organizationId, botId, force);
    } finally {
      // A Tidy now is no longer under way, whatever the dream came to.
      if (force) await this.dreams.settle(organizationId, botId);
    }
  }

  private async dreamOnce(organizationId: string, botId: string, force: boolean): Promise<void> {
    const dream = await this.dreamer.dream(organizationId, botId, force);
    if (!dream) return;
    const outcome = await this.dreams.apply(dream, BOT_MEMORY_FACTS_MAX);
    if (outcome !== 'applied') {
      this.logger.log({ message: "A bot's dream was not applied", botId, outcome });
      return;
    }
    const line = dreamLine({
      id: dream.id,
      organizationId,
      botId,
      activity: 'dreamed',
      factsBefore: dream.read.length,
      factsAfter: dream.facts.length,
      note: dream.note,
      at: new Date(),
    });
    if (await this.messages.insertOnce(line)) {
      await this.stream.publish(botId, { type: 'message', turnId: null, messageId: line.id });
    }
  }
}
