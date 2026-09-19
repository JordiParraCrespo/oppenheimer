import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { FindProjectsQuery } from './find-projects.query';

@QueryHandler(FindProjectsQuery)
export class FindProjectsQueryHandler implements IQueryHandler<FindProjectsQuery, ProjectEntity[]> {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(query: FindProjectsQuery): Promise<ProjectEntity[]> {
    return this.projects.findAll(query.scope);
  }
}
