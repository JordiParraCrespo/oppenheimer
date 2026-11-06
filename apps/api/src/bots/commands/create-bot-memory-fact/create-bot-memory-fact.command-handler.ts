import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_MEMORY_FACTS_MAX } from '@oppenheimer/shared';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_MEMORY_FACT_REPOSITORY } from '../../bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../database/bot-memory-fact.repository.port';
import { userActor } from '../../domain/bot.types';
import { BotMemoryFactEntity } from '../../domain/bot-memory-fact.entity';
import { BotErrors } from '../../domain/bots.errors';
import { CreateBotMemoryFactCommand } from './create-bot-memory-fact.command';

/**
 * A fact added by hand in Settings → Memory while the bot has room for one,
 * or saved by the bot through `remember`, which makes room by letting its
 * oldest `log` fact go (`25-bots.md` §4.1).
 */
@CommandHandler(CreateBotMemoryFactCommand)
export class CreateBotMemoryFactCommandHandler
  implements ICommandHandler<CreateBotMemoryFactCommand, AggregateID>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_MEMORY_FACT_REPOSITORY)
    private readonly memory: BotMemoryFactRepositoryPort,
  ) {}

  async execute(command: CreateBotMemoryFactCommand): Promise<AggregateID> {
    const { scope, botId, content } = command;
    const bot = await this.lookup.bot(scope, botId);
    const byBot = command.author === 'bot';
    const fact = BotMemoryFactEntity.createNew({
      organizationId: bot.organizationId,
      botId: bot.id,
      content,
      actor: byBot ? { kind: 'bot' } : userActor(scope.userId),
      tier: command.tier,
      scope: command.memoryScope,
    });
    const outcome = await this.memory.insert(fact, BOT_MEMORY_FACTS_MAX, byBot);
    if (outcome === 'full') {
      throw new AppError(BotErrors.MEMORY_FULL, {
        detail: `A bot keeps at most ${BOT_MEMORY_FACTS_MAX} facts; forget one first`,
      });
    }
    if (outcome === 'missing') throw new AppError(BotErrors.NOT_FOUND);
    return fact.id;
  }
}
