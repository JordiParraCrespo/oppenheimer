import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { LinkTaskSessionCommand } from './link-task-session.command';

/**
 * Links a session that already exists, under the same attach rule as Start: a task
 * not started moves to In progress if it is still where the person saw it. The
 * session's own workspace key refuses one from another workspace.
 */
@CommandHandler(LinkTaskSessionCommand)
export class LinkTaskSessionCommandHandler
  implements ICommandHandler<LinkTaskSessionCommand, AggregateID>
{
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
  ) {}

  async execute(command: LinkTaskSessionCommand): Promise<AggregateID> {
    const { scope, taskId, sessionId } = command;
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
    const outcome = await this.tasks.attach(
      task,
      { sessionId, origin: 'linked', linkedByUserId: command.userId, linkedAt: new Date() },
      command.seenStatus,
    );
    if (outcome === 'session-not-found') {
      throw new AppError(TaskErrors.SESSION_NOT_FOUND, {
        detail: `No session with id ${sessionId}`,
      });
    }
    return task.id;
  }
}
