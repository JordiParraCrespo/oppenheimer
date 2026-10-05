import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { MoveTaskCommand } from './move-task.command';

/**
 * Into a column, first or directly after another of its tasks. Ticking a card done
 * is a move to the top of Done, and unticking one a move to the top of To do.
 */
@CommandHandler(MoveTaskCommand)
export class MoveTaskCommandHandler implements ICommandHandler<MoveTaskCommand, AggregateID> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
  ) {}

  async execute({ scope, taskId, move }: MoveTaskCommand): Promise<AggregateID> {
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
    const outcome = await this.tasks.move(task, {
      status: move.status,
      after:
        move.afterTaskId === null ? { kind: 'first' } : { kind: 'task', taskId: move.afterTaskId },
    });
    if (outcome === 'stale-position') {
      throw new AppError(TaskErrors.STALE_POSITION, {
        detail: `Task ${move.afterTaskId} is not in ${move.status}`,
      });
    }
    return task.id;
  }
}
