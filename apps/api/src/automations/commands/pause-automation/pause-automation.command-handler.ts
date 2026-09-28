import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { AutomationErrors } from '../../domain/automations.errors';
import { PauseAutomationCommand } from './pause-automation.command';

/** Pause: triggers are ignored until it is resumed; Run now still works. */
@CommandHandler(PauseAutomationCommand)
export class PauseAutomationCommandHandler
  implements ICommandHandler<PauseAutomationCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute(command: PauseAutomationCommand): Promise<AggregateID> {
    const automation = requireFound(
      await this.automations.findOneById(command.scope, command.automationId),
      AutomationErrors.NOT_FOUND,
    );
    automation.pause('user', new Date());
    if ((await this.automations.save(automation, automation.version)) === 'conflict') {
      throw new AppError(AutomationErrors.VERSION_CONFLICT);
    }
    return automation.id;
  }
}
