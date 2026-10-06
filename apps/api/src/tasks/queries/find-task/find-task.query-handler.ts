import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import type { TaskEntity } from '../../domain/task.entity';
import { TaskErrors } from '../../domain/tasks.errors';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { FindTaskQuery } from './find-task.query';

@QueryHandler(FindTaskQuery)
export class FindTaskQueryHandler implements IQueryHandler<FindTaskQuery, TaskEntity> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
  ) {}

  async execute({ scope, taskId }: FindTaskQuery): Promise<TaskEntity> {
    return requireFound(await this.tasks.findOneById(scope, taskId), TaskErrors.NOT_FOUND, {
      detail: `No task with id ${taskId}`,
    });
  }
}
