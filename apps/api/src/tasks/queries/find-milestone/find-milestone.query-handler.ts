import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type {
  MilestoneRepositoryPort,
  MilestoneWithProgress,
} from '../../database/milestone.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { MILESTONE_REPOSITORY } from '../../tasks.di-tokens';
import { FindMilestoneQuery } from './find-milestone.query';

/** No route of its own: the milestone writes read their answer back through it. */
@QueryHandler(FindMilestoneQuery)
export class FindMilestoneQueryHandler
  implements IQueryHandler<FindMilestoneQuery, MilestoneWithProgress>
{
  constructor(
    @Inject(MILESTONE_REPOSITORY)
    private readonly milestones: MilestoneRepositoryPort,
  ) {}

  async execute({ scope, milestoneId }: FindMilestoneQuery): Promise<MilestoneWithProgress> {
    const milestone = requireFound(
      await this.milestones.findOneById(scope, milestoneId),
      TaskErrors.MILESTONE_NOT_FOUND,
      {
        detail: `No milestone with id ${milestoneId}`,
      },
    );
    return { milestone, progress: await this.milestones.progressOf(milestone) };
  }
}
