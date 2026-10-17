import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_MEMORY_FACT_REPOSITORY } from '../../bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../database/bot-memory-fact.repository.port';
import { ClearBotMemoryCommand } from './clear-bot-memory.command';

/** Settings → Memory's "Clear all": the bot forgets everything; who it is stays. */
@CommandHandler(ClearBotMemoryCommand)
export class ClearBotMemoryCommandHandler
  implements ICommandHandler<ClearBotMemoryCommand, AggregateID>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_MEMORY_FACT_REPOSITORY)
    private readonly memory: BotMemoryFactRepositoryPort,
  ) {}

  async execute({ scope, botId }: ClearBotMemoryCommand): Promise<AggregateID> {
    const bot = await this.lookup.bot(scope, botId);
    await this.memory.clear(bot);
    return bot.id;
  }
}
