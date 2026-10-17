import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TaskFilingResolver } from '../../application/task-filing.resolver';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { UpdateTaskCommand } from './update-task.command';

/**
 * Changes what a person edits in the task dialog. Its column is a move, not an
 * edit; filing it under another project or milestone goes through the same rules as
 * creating it.
 */
@CommandHandler(UpdateTaskCommand)
export class UpdateTaskCommandHandler implements ICommandHandler<UpdateTaskCommand, AggregateID> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
    private readonly filing: TaskFilingResolver,
  ) {}

  async execute({ scope, actor, taskId, changes }: UpdateTaskCommand): Promise<AggregateID> {
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
    task.actingAs(actor).expectVersion(changes.expectedVersion);
    task.edit({
      title: changes.title,
      notes: changes.notes,
      dueDate: changes.dueDate,
      dueTime: changes.dueTime,
    });
    if (changes.projectId !== undefined || changes.milestoneId !== undefined) {
      const filed = await this.filing.resolve(
        scope,
        { projectId: changes.projectId, milestoneId: changes.milestoneId },
        { projectId: task.projectId, milestoneId: task.milestoneId },
      );
      task.file(filed.projectId, filed.milestoneId);
    }
    if (changes.blockedReason !== undefined) task.block(changes.blockedReason);
    const outcome = await this.tasks.saveFields(task);
    if (outcome === 'version-conflict') {
      throw new AppError(TaskErrors.VERSION_CONFLICT, {
        detail: `Task ${task.id} is no longer at version ${task.expectedVersion}`,
      });
    }
    return task.id;
  }
}
