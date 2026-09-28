import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AutomationPlanFactory } from '../../application/automation-plan.factory';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { RevisionInput } from '../../domain/automation.entity';
import { AutomationErrors } from '../../domain/automations.errors';
import { UpdateAutomationCommand } from './update-automation.command';

/**
 * Save. Only what the editor sent is confirmed and changed; a change to what a
 * run executes becomes the next revision. The version the editor loaded must
 * still be the stored one, so two tabs cannot silently overwrite each other.
 */
@CommandHandler(UpdateAutomationCommand)
export class UpdateAutomationCommandHandler
  implements ICommandHandler<UpdateAutomationCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    private readonly plan: AutomationPlanFactory,
  ) {}

  async execute(command: UpdateAutomationCommand): Promise<AggregateID> {
    const { scope, input } = command;
    const found = await this.automations.findOneById(scope, command.automationId);
    if (found.isNone()) throw new AppError(AutomationErrors.NOT_FOUND);
    const automation = found.unwrap();
    if (automation.version !== input.version) throw new AppError(AutomationErrors.VERSION_CONFLICT);
    const now = new Date();

    const revision: Partial<RevisionInput> = {};
    if (input.agent !== undefined) {
      this.plan.assertAgent(input.agent);
      revision.agent = input.agent;
    }
    if (input.hostId !== undefined) {
      await this.plan.assertHost(scope, input.hostId);
      revision.hostId = input.hostId;
    }
    if (input.repositories !== undefined) {
      revision.repositories = await this.plan.resolveRepositories(scope, input.repositories);
    }
    if (input.prompt !== undefined) revision.prompt = input.prompt;
    if (input.launch !== undefined) {
      revision.model = input.launch.model ?? null;
      revision.permission = input.launch.permission;
      revision.effort = input.launch.effort ?? null;
    }
    if (input.projectId !== undefined) await this.plan.assertProject(scope, input.projectId);

    automation.change(
      {
        name: input.name,
        projectId: input.projectId,
        revision,
        triggers: input.triggers ? this.plan.triggers(input.triggers, now) : undefined,
        overlap: input.overlap,
        maxRunsPerHour: input.maxRunsPerHour,
      },
      scope.userId,
      now,
    );
    const outcome = await this.automations.save(automation, input.version);
    if (outcome === 'conflict') throw new AppError(AutomationErrors.VERSION_CONFLICT);
    return automation.id;
  }
}
