import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { GoalRepositoryPort, GoalWithProgress } from '../../database/goal.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { GOAL_REPOSITORY } from '../../tasks.di-tokens';
import { FindGoalQuery } from './find-goal.query';

/** No route of its own: the goal writes read their answer back through it. */
@QueryHandler(FindGoalQuery)
export class FindGoalQueryHandler implements IQueryHandler<FindGoalQuery, GoalWithProgress> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goals: GoalRepositoryPort,
  ) {}

  async execute({ scope, goalId }: FindGoalQuery): Promise<GoalWithProgress> {
    const goal = requireFound(
      await this.goals.findOneById(scope, goalId),
      TaskErrors.GOAL_NOT_FOUND,
      {
        detail: `No goal with id ${goalId}`,
      },
    );
    return { goal, progress: await this.goals.progressOf(goal) };
  }
}
