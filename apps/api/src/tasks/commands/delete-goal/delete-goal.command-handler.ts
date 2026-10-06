import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { GoalRepositoryPort } from '../../database/goal.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { GOAL_REPOSITORY } from '../../tasks.di-tokens';
import { DeleteGoalCommand } from './delete-goal.command';

/** Deletes the goal; its tasks stay in their project with no goal. */
@CommandHandler(DeleteGoalCommand)
export class DeleteGoalCommandHandler implements ICommandHandler<DeleteGoalCommand, AggregateID> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goals: GoalRepositoryPort,
  ) {}

  async execute({ scope, goalId }: DeleteGoalCommand): Promise<AggregateID> {
    const goal = requireFound(
      await this.goals.findOneById(scope, goalId),
      TaskErrors.GOAL_NOT_FOUND,
      {
        detail: `No goal with id ${goalId}`,
      },
    );
    await this.goals.delete(goal);
    return goal.id;
  }
}
