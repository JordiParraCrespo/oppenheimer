import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotLoopResolver } from '../../application/bot-loop.resolver';
import { BOT_LOOP_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotLoopRepositoryPort } from '../../database/bot-loop.repository.port';
import { ClearBotLoopCommand } from './clear-bot-loop.command';

/**
 * Stop a bot's loop from its chat (`25-bots.md` §4.1, `/loop`): the loop
 * ends with a line saying the owner stopped it, and a run still waiting is
 * cancelled with it (`BotLoopResolver`). A running one finishes its turn;
 * with the loop gone, its next run's job finds nothing. No loop is no error.
 */
@CommandHandler(ClearBotLoopCommand)
export class ClearBotLoopCommandHandler implements ICommandHandler<ClearBotLoopCommand, void> {
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_LOOP_REPOSITORY) private readonly loops: BotLoopRepositoryPort,
    private readonly loopsOf: BotLoopResolver,
  ) {}

  async execute({ scope, botId, metadata }: ClearBotLoopCommand): Promise<void> {
    const bot = await this.lookup.bot(scope, botId);
    const loop = await this.loops.findForBot(bot.organizationId, bot.id);
    if (!loop) return;
    await this.loopsOf.end(loop, { activity: 'cleared', reason: null }, metadata.correlationId);
  }
}
