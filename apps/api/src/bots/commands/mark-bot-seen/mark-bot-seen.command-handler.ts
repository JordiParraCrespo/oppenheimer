import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ResumeUnattendedRoutinesCommand } from '../../../automations/commands/resume-unattended-routines/resume-unattended-routines.command';
import { BOT_REPOSITORY } from '../../bots.di-tokens';
import type { BotRepositoryPort } from '../../database/bot.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { MarkBotSeenCommand } from './mark-bot-seen.command';

/**
 * Records that the owner is in the bot's chat, then resumes the routines the
 * spend guard paused while they were away, as an agent that stopped watching
 * a pull request comes back when written to. A bot in another workspace is
 * not found.
 */
@CommandHandler(MarkBotSeenCommand)
export class MarkBotSeenCommandHandler implements ICommandHandler<MarkBotSeenCommand, AggregateID> {
  constructor(
    @Inject(BOT_REPOSITORY)
    private readonly bots: BotRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  async execute({ scope, botId }: MarkBotSeenCommand): Promise<AggregateID> {
    requireTenant(scope);
    if (!(await this.bots.markSeen(scope, botId, new Date()))) {
      throw new AppError(BotErrors.NOT_FOUND);
    }
    await this.commands.execute(
      new ResumeUnattendedRoutinesCommand({ organizationId: scope.organizationId, botId }),
    );
    return botId;
  }
}
