import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TaskFilingResolver } from '../../application/task-filing.resolver';
import type { MilestoneRepositoryPort } from '../../database/milestone.repository.port';
import { MilestoneEntity } from '../../domain/milestone.entity';
import { TaskErrors } from '../../domain/tasks.errors';
import { MILESTONE_REPOSITORY } from '../../tasks.di-tokens';
import { CreateMilestoneCommand } from './create-milestone.command';

/** A milestone for an active project. */
@CommandHandler(CreateMilestoneCommand)
export class CreateMilestoneCommandHandler
  implements ICommandHandler<CreateMilestoneCommand, AggregateID>
{
  constructor(
    @Inject(MILESTONE_REPOSITORY)
    private readonly milestones: MilestoneRepositoryPort,
    private readonly filing: TaskFilingResolver,
  ) {}

  async execute({ scope, userId, input }: CreateMilestoneCommand): Promise<AggregateID> {
    if (!scope.organizationId) throw new AppError(TaskErrors.NO_ACTIVE_ORGANIZATION);
    const milestone = MilestoneEntity.createNew({
      organizationId: scope.organizationId,
      projectId: await this.filing.activeProject(scope, input.projectId),
      name: input.name,
      targetDate: input.targetDate ?? null,
      createdByUserId: userId,
    });
    await this.milestones.insert(milestone);
    return milestone.id;
  }
}
