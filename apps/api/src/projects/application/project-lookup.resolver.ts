import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, type Option } from 'oxide.ts';
import type { ProjectRepositoryPort } from '../database/project.repository.port';
import type { ProjectEntity } from '../domain/project.entity';
import { PROJECT_REPOSITORY } from '../projects.di-tokens';
import type { ProjectLookupPort } from './project-lookup.port';

/** Reads a project for another module, through the caller's scope. */
@Injectable()
export class ProjectLookupResolver implements ProjectLookupPort {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async findOneById(scope: AccessScope, projectId: string): Promise<Option<ProjectEntity>> {
    return active(await this.projects.findOneById(scope, projectId));
  }
}

/** An archived project is not one new work can be listed under, so it reads as absent. */
function active(found: Option<ProjectEntity>): Option<ProjectEntity> {
  return found.isSome() && found.unwrap().isArchived ? None : found;
}
