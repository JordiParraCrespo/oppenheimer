import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import { AutomationRunEntity } from '../../domain/automation-run.entity';
import { AutomationErrors } from '../../domain/automations.errors';
import { manualCauseSummary } from '../../domain/run-launch.policy';
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
    const found = await this.automations.findOneById(command.scope, command.automationId);
    if (found.isNone()) throw new AppError(AutomationErrors.NOT_FOUND);
    const automation = found.unwrap();
    const run = AutomationRunEntity.fire(
      {
        organizationId: automation.organizationId,
        automationId: automation.id,
        revisionId: automation.revision.id,
        triggerId: null,
        cause: 'manual',
        causeKey: `manual:${command.idempotencyKey ?? command.id}`,
        causeSummary: manualCauseSummary(),
        inboundEventId: null,
        scheduledFor: null,
        requestedByUserId: command.scope.userId,
      },
      new Date(),
    );
    return (await this.runs.insertFiring(run)).runId;
  }
}
