import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { UnlinkTaskSessionCommand } from './unlink-task-session.command';

/** Takes a session off the task. The task stays where it is, and so does the session. */
@CommandHandler(UnlinkTaskSessionCommand)
export class UnlinkTaskSessionCommandHandler
  implements ICommandHandler<UnlinkTaskSessionCommand, AggregateID>
{
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
  ) {}

  async execute({ scope, taskId, sessionId }: UnlinkTaskSessionCommand): Promise<AggregateID> {
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
    await this.tasks.detach(task, sessionId);
    return task.id;
  }
}
