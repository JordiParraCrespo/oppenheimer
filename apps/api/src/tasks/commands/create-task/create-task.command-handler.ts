import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TaskFilingResolver } from '../../application/task-filing.resolver';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskEntity } from '../../domain/task.entity';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { CreateTaskCommand } from './create-task.command';

/** A new task, filed by the request's project and goal, at the end of its column. */
@CommandHandler(CreateTaskCommand)
export class CreateTaskCommandHandler implements ICommandHandler<CreateTaskCommand, AggregateID> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
    private readonly filing: TaskFilingResolver,
  ) {}

  async execute({ scope, userId, input }: CreateTaskCommand): Promise<AggregateID> {
    if (!scope.organizationId) throw new AppError(TaskErrors.NO_ACTIVE_ORGANIZATION);
    const filed = await this.filing.resolve(scope, {
      projectId: input.projectId,
      goalId: input.goalId,
    });
    const task = TaskEntity.createNew({
      organizationId: scope.organizationId,
      ...filed,
      status: input.status,
      title: input.title,
      notes: input.notes,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      createdByUserId: userId,
    });
    // `last` names no other task, so the placement cannot be stale.
    await this.tasks.insert(task, { status: input.status, after: { kind: 'last' } });
    return task.id;
  }
}
