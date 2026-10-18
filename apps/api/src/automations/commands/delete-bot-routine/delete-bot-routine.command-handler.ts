import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BotRoutineResolver } from '../../application/bot-routine.resolver';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { AutomationErrors } from '../../domain/automations.errors';
import { DeleteBotRoutineCommand } from './delete-bot-routine.command';

/** Delete a bot's routine: a tombstone, as any automation's. Its triggers stop; its runs are kept. */
@CommandHandler(DeleteBotRoutineCommand)
export class DeleteBotRoutineCommandHandler
  implements ICommandHandler<DeleteBotRoutineCommand, AggregateID>
{
  constructor(
    private readonly routines: BotRoutineResolver,
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute(command: DeleteBotRoutineCommand): Promise<AggregateID> {
    const routine = await this.routines.require(command.scope, command.botId, command.routineId);
    routine.delete(new Date());
    if ((await this.automations.save(routine, routine.version)) === 'conflict') {
      throw new AppError(AutomationErrors.VERSION_CONFLICT);
    }
    return routine.id;
  }
}
