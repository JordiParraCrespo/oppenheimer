import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import { AutomationRunEntity } from '../../domain/automation-run.entity';
import { AutomationErrors } from '../../domain/automations.errors';
import { manualFiring } from '../../domain/run-launch.policy';
import { RunAutomationCommand } from './run-automation.command';

/**
 * Run now: a firing like any other, queued for the dispatcher, which starts the
 * session as the owner. It works while paused — a person asking is not a
 * trigger — and the hourly caps do not apply to it.
 */
@CommandHandler(RunAutomationCommand)
export class RunAutomationCommandHandler
  implements ICommandHandler<RunAutomationCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  async execute(command: RunAutomationCommand): Promise<AggregateID> {
    const automation = requireFound(
      await this.automations.findOneById(command.scope, command.automationId),
      AutomationErrors.NOT_FOUND,
    );
    const run = AutomationRunEntity.fire(
      manualFiring(automation, command.scope.userId, command.idempotencyKey ?? command.id),
      new Date(),
    );
    return (await this.runs.insertFiring(run, command.metadata.correlationId)).runId;
  }
}
