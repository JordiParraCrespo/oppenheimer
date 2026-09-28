import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { AutomationErrors } from '../../domain/automations.errors';
import { DeleteAutomationCommand } from './delete-automation.command';

/** Delete: a tombstone. Its triggers stop now; past runs are kept and read “Deleted automation”. */
@CommandHandler(DeleteAutomationCommand)
export class DeleteAutomationCommandHandler
  implements ICommandHandler<DeleteAutomationCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute(command: DeleteAutomationCommand): Promise<AggregateID> {
    const found = await this.automations.findOneById(command.scope, command.automationId);
    if (found.isNone()) throw new AppError(AutomationErrors.NOT_FOUND);
    const automation = found.unwrap();
    automation.delete(new Date());
    if ((await this.automations.save(automation, automation.version)) === 'conflict') {
      throw new AppError(AutomationErrors.VERSION_CONFLICT);
    }
    return automation.id;
  }
}
