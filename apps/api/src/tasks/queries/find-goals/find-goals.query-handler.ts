import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { GoalRepositoryPort, GoalWithProgress } from '../../database/goal.repository.port';
import { GOAL_REPOSITORY } from '../../tasks.di-tokens';
import { FindGoalsQuery } from './find-goals.query';

@QueryHandler(FindGoalsQuery)
export class FindGoalsQueryHandler implements IQueryHandler<FindGoalsQuery, GoalWithProgress[]> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goals: GoalRepositoryPort,
  ) {}

  async execute({ scope, projectId }: FindGoalsQuery): Promise<GoalWithProgress[]> {
    return this.goals.findAll(scope, { projectId });
  }
}
