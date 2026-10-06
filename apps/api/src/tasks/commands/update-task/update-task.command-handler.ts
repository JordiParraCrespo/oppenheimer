import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TaskFilingResolver } from '../../application/task-filing.resolver';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { UpdateTaskCommand } from './update-task.command';

/**
 * Changes what a person edits in the task dialog. Its column is a move, not an
 * edit; filing it under another project or goal goes through the same rules as
 * creating it.
 */
@CommandHandler(UpdateTaskCommand)
export class UpdateTaskCommandHandler implements ICommandHandler<UpdateTaskCommand, AggregateID> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
    private readonly filing: TaskFilingResolver,
  ) {}

  async execute({ scope, taskId, changes }: UpdateTaskCommand): Promise<AggregateID> {
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
    task.edit({
      title: changes.title,
      notes: changes.notes,
      dueDate: changes.dueDate,
      dueTime: changes.dueTime,
    });
    if (changes.projectId !== undefined || changes.goalId !== undefined) {
      const filed = await this.filing.resolve(
        scope,
        { projectId: changes.projectId, goalId: changes.goalId },
        { projectId: task.projectId, goalId: task.goalId },
      );
      task.file(filed.projectId, filed.goalId);
    }
    await this.tasks.saveFields(task);
    return task.id;
  }
}
