import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { TaskRepositoryPort } from '../../database/task.repository.port';
import type { TaskEntity } from '../../domain/task.entity';
import { TASK_REPOSITORY } from '../../tasks.di-tokens';
import { FindTasksQuery } from './find-tasks.query';

@QueryHandler(FindTasksQuery)
export class FindTasksQueryHandler implements IQueryHandler<FindTasksQuery, TaskEntity[]> {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly tasks: TaskRepositoryPort,
  ) {}

  async execute({ scope, filter }: FindTasksQuery): Promise<TaskEntity[]> {
    return this.tasks.findAll(scope, filter);
  }
}
