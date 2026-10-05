import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command';
import type { SessionCommandResult } from '../../../sessions/domain/session-command.types';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { StartTaskSessionCommand } from './start-task-session.command';

/**
 * Starts a session for a task, through the same command New session sends, filed
 * under the task's project (`product/versions/mvp/19-plan-tasks-and-goals.md` §5).
 * A person clicked Start, so the session's origin is `person`; that it came from
 * this task is the link's `started`.
 *
 * There is no transaction across the two modules. The session's idempotency key is
 * derived from the task and the caller's key, so a retry after the session was
 * made gets it back, and the attach that follows is idempotent on the link's key.
 */
@CommandHandler(StartTaskSessionCommand)
export class StartTaskSessionCommandHandler
  implements ICommandHandler<StartTaskSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: StartTaskSessionCommand): Promise<SessionCommandResult> {
    const { scope, userId, taskId, input } = command;
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });

    const result = await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
      new CreateSessionCommand({
        scope,
        userId,
        input: { ...input.session, projectId: task.projectId },
        idempotencyKey: command.idempotencyKey ? `task:${task.id}:${command.idempotencyKey}` : null,
        origin: 'person',
      }),
    );

    // The session exists whatever happens next; a link that fails is retried
    // with the same key and finds it.
    await this.tasks.attach(
      task,
      {
        sessionId: result.sessionId,
        origin: 'started',
        linkedByUserId: userId,
        linkedAt: new Date(),
      },
      input.seenStatus,
    );
    return result;
  }
}
