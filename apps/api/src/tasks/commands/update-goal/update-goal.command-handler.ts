import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TaskFilingResolver } from '../../application/task-filing.resolver';
import type { GoalRepositoryPort } from '../../database/goal.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { GOAL_REPOSITORY } from '../../tasks.di-tokens';
import { UpdateGoalCommand } from './update-goal.command';

/** Renames, retargets or moves a goal; a move takes its tasks to the new project with it. */
@CommandHandler(UpdateGoalCommand)
export class UpdateGoalCommandHandler implements ICommandHandler<UpdateGoalCommand, AggregateID> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goals: GoalRepositoryPort,
    private readonly filing: TaskFilingResolver,
  ) {}

  async execute({ scope, goalId, changes }: UpdateGoalCommand): Promise<AggregateID> {
    const goal = requireFound(
      await this.goals.findOneById(scope, goalId),
      TaskErrors.GOAL_NOT_FOUND,
      {
        detail: `No goal with id ${goalId}`,
      },
    );
    const projectId =
      changes.projectId !== undefined && changes.projectId !== goal.projectId
        ? await this.filing.activeProject(scope, changes.projectId)
        : undefined;
    goal.edit({ name: changes.name, targetDate: changes.targetDate, projectId });
    await this.goals.save(goal);
    return goal.id;
  }
}
