import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { FindProjectQuery } from './find-project.query';

@QueryHandler(FindProjectQuery)
export class FindProjectQueryHandler implements IQueryHandler<FindProjectQuery, ProjectEntity> {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(query: FindProjectQuery): Promise<ProjectEntity> {
    const found = await this.projects.findOneById(query.scope, query.projectId);

    // A project in another workspace is reported as missing, not forbidden: the
    // scoped read cannot see it, and saying otherwise would confirm the id.
    if (found.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project with id ${query.projectId}`,
      });
    }

    return found.unwrap();
  }
}
