import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type {
  MilestoneRepositoryPort,
  MilestoneWithProgress,
} from '../../database/milestone.repository.port';
import { MILESTONE_REPOSITORY } from '../../tasks.di-tokens';
import { FindMilestonesQuery } from './find-milestones.query';

@QueryHandler(FindMilestonesQuery)
export class FindMilestonesQueryHandler
  implements IQueryHandler<FindMilestonesQuery, MilestoneWithProgress[]>
{
  constructor(
    @Inject(MILESTONE_REPOSITORY)
    private readonly milestones: MilestoneRepositoryPort,
  ) {}

  async execute({ scope, projectId }: FindMilestonesQuery): Promise<MilestoneWithProgress[]> {
    return this.milestones.findAll(scope, { projectId });
  }
}
