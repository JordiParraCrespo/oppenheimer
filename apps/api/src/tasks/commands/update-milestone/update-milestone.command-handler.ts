import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TaskFilingResolver } from '../../application/task-filing.resolver';
import type { MilestoneRepositoryPort } from '../../database/milestone.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { MILESTONE_REPOSITORY } from '../../tasks.di-tokens';
import { UpdateMilestoneCommand } from './update-milestone.command';

/** Renames, retargets or moves a milestone; a move takes its tasks to the new project with it. */
@CommandHandler(UpdateMilestoneCommand)
export class UpdateMilestoneCommandHandler
  implements ICommandHandler<UpdateMilestoneCommand, AggregateID>
{
  constructor(
    @Inject(MILESTONE_REPOSITORY)
    private readonly milestones: MilestoneRepositoryPort,
    private readonly filing: TaskFilingResolver,
  ) {}

  async execute({ scope, milestoneId, changes }: UpdateMilestoneCommand): Promise<AggregateID> {
    const milestone = requireFound(
      await this.milestones.findOneById(scope, milestoneId),
      TaskErrors.MILESTONE_NOT_FOUND,
      {
        detail: `No milestone with id ${milestoneId}`,
      },
    );
    const projectId =
      changes.projectId !== undefined && changes.projectId !== milestone.projectId
        ? await this.filing.activeProject(scope, changes.projectId)
        : undefined;
    milestone.edit({ name: changes.name, targetDate: changes.targetDate, projectId });
    await this.milestones.save(milestone);
    return milestone.id;
  }
}
