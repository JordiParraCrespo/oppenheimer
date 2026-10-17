import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { DeleteTaskCommand } from './delete-task.command';

/** Deletes the task and its links. Its sessions are untouched: they are their own. */
@CommandHandler(DeleteTaskCommand)
export class DeleteTaskCommandHandler implements ICommandHandler<DeleteTaskCommand, AggregateID> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
  ) {}

  async execute({
    scope,
    actor,
    expectedVersion,
    taskId,
  }: DeleteTaskCommand): Promise<AggregateID> {
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
    task.actingAs(actor).expectVersion(expectedVersion);
    const outcome = await this.tasks.delete(task);
    if (outcome === 'version-conflict') {
      throw new AppError(TaskErrors.VERSION_CONFLICT, {
        detail: `Task ${task.id} is no longer at version ${task.expectedVersion}`,
      });
    }
    return task.id;
  }
}
