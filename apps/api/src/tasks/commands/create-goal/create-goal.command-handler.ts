import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TaskFilingResolver } from '../../application/task-filing.resolver';
import type { GoalRepositoryPort } from '../../database/goal.repository.port';
import { GoalEntity } from '../../domain/goal.entity';
import { TaskErrors } from '../../domain/tasks.errors';
import { GOAL_REPOSITORY } from '../../tasks.di-tokens';
import { CreateGoalCommand } from './create-goal.command';

/** A goal for an active project. */
@CommandHandler(CreateGoalCommand)
export class CreateGoalCommandHandler implements ICommandHandler<CreateGoalCommand, AggregateID> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goals: GoalRepositoryPort,
    private readonly filing: TaskFilingResolver,
  ) {}

  async execute({ scope, userId, input }: CreateGoalCommand): Promise<AggregateID> {
    if (!scope.organizationId) throw new AppError(TaskErrors.NO_ACTIVE_ORGANIZATION);
    const goal = GoalEntity.createNew({
      organizationId: scope.organizationId,
      projectId: await this.filing.activeProject(scope, input.projectId),
      name: input.name,
      targetDate: input.targetDate ?? null,
      createdByUserId: userId,
    });
    await this.goals.insert(goal);
    return goal.id;
  }
}
