import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { MilestoneRepositoryPort } from '../../database/milestone.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { MILESTONE_REPOSITORY } from '../../tasks.di-tokens';
import { DeleteMilestoneCommand } from './delete-milestone.command';

/** Deletes the milestone; its tasks stay in their project with no milestone. */
@CommandHandler(DeleteMilestoneCommand)
export class DeleteMilestoneCommandHandler
  implements ICommandHandler<DeleteMilestoneCommand, AggregateID>
{
  constructor(
    @Inject(MILESTONE_REPOSITORY)
    private readonly milestones: MilestoneRepositoryPort,
  ) {}

  async execute({
    scope,
    actor,
    expectedVersion,
    milestoneId,
  }: DeleteMilestoneCommand): Promise<AggregateID> {
    const milestone = requireFound(
      await this.milestones.findOneById(scope, milestoneId),
      TaskErrors.MILESTONE_NOT_FOUND,
      {
        detail: `No milestone with id ${milestoneId}`,
      },
    );
    milestone.actingAs(actor).expectVersion(expectedVersion);
    const outcome = await this.milestones.delete(milestone);
    if (outcome === 'version-conflict') {
      throw new AppError(TaskErrors.VERSION_CONFLICT, {
        detail: `Milestone ${milestone.id} is no longer at version ${milestone.expectedVersion}`,
      });
    }
    return milestone.id;
  }
}
