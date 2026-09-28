import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { AutomationErrors } from '../../domain/automations.errors';
import { ResumeAutomationCommand } from './resume-automation.command';

/** Resume: triggers listen again, and every schedule's next slot is computed from now — a paused week does not fire a burst of missed slots. */
@CommandHandler(ResumeAutomationCommand)
export class ResumeAutomationCommandHandler
  implements ICommandHandler<ResumeAutomationCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute(command: ResumeAutomationCommand): Promise<AggregateID> {
    const found = await this.automations.findOneById(command.scope, command.automationId);
    if (found.isNone()) throw new AppError(AutomationErrors.NOT_FOUND);
    const automation = found.unwrap();
    automation.resume(new Date());
    if ((await this.automations.save(automation, automation.version)) === 'conflict') {
      throw new AppError(AutomationErrors.VERSION_CONFLICT);
    }
    return automation.id;
  }
}
