import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { TriageTaskCommand } from './triage-task.command';

/**
 * Dismiss from the Inbox: the person takes up a task an agent made without
 * planning it or starting work on it, so it leaves the Inbox and stays on the
 * board as it is (`29-inbox.md`, "Tasks an agent made"). A task already taken
 * up, or a request an agent made, changes nothing.
 */
@CommandHandler(TriageTaskCommand)
export class TriageTaskCommandHandler implements ICommandHandler<TriageTaskCommand, AggregateID> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
  ) {}

  async execute({ scope, actor, origin, taskId }: TriageTaskCommand): Promise<AggregateID> {
    const task = requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
    if (task.triagedAt !== null) return task.id;
    task.actingAs(actor).triage(origin);
    if (task.triagedAt !== null) await this.tasks.saveTriage(task);
    return task.id;
  }
}
