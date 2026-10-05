import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AutomationPlanFactory } from '../../application/automation-plan.factory';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { AutomationEntity } from '../../domain/automation.entity';
import { AutomationErrors } from '../../domain/automations.errors';
import { CreateAutomationCommand } from './create-automation.command';

/**
 * What it names is confirmed as the caller — who becomes its
 * owner — and it starts listening the moment it is saved: its schedule
 * triggers get their first `nextFireAt` in the same write.
 */
@CommandHandler(CreateAutomationCommand)
export class CreateAutomationCommandHandler
  implements ICommandHandler<CreateAutomationCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    private readonly plan: AutomationPlanFactory,
  ) {}

  async execute(command: CreateAutomationCommand): Promise<AggregateID> {
    const { scope, input } = command;
    if (!scope.organizationId) throw new AppError(AutomationErrors.NO_ACTIVE_ORGANIZATION);
    const now = new Date();

    this.plan.assertAgent(input.agent);
    await this.plan.assertProject(scope, input.projectId);
    await this.plan.assertHost(scope, input.hostId);
    const repositories = await this.plan.resolveRepositories(scope, input.repositories);
    const triggers = this.plan.triggers(input.triggers, now);

    const automation = AutomationEntity.createNew({
      organizationId: scope.organizationId,
      projectId: input.projectId,
      ownerUserId: scope.userId,
      name: input.name,
      revision: {
        hostId: input.hostId,
        agent: input.agent,
        model: input.launch.model ?? null,
        permission: input.launch.permission,
        effort: input.launch.effort ?? null,
        prompt: input.prompt,
        repositories,
        createdByUserId: scope.userId,
      },
      triggers,
      active: input.active,
      overlap: input.overlap ?? null,
      maxRunsPerHour: input.maxRunsPerHour ?? null,
      now,
    });
    await this.automations.insert(automation);
    return automation.id;
  }
}
