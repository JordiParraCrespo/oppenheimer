import { Inject, Injectable } from '@nestjs/common';
import { requireFound } from '@oppenheimer/backend-core';
import { None, type Option } from 'oxide.ts';
import { requireTenant } from '../../authz/application/tenant-scope.policy';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import type { ProjectRepositoryPort } from '../database/project.repository.port';
import type { ProjectEntity } from '../domain/project.entity';
import { ProjectErrors } from '../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../projects.di-tokens';
import type { ProjectLookupPort } from './project-lookup.port';

@Injectable()
export class ProjectLookupResolver implements ProjectLookupPort {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async findOneById(scope: AccessScope, projectId: string): Promise<Option<ProjectEntity>> {
    return active(await this.projects.findOneById(scope, projectId));
  }

  async unassigned(scope: AccessScope): Promise<ProjectEntity> {
    const found = await this.projects.findUnassigned(scope);
    if (found.isSome()) return found.unwrap();
    requireTenant(scope);
    await this.projects.provisionUnassigned(scope.organizationId);
    // Written a moment ago under this very workspace; unreadable means the
    // scope cannot see its own workspace's projects.
    return requireFound(await this.projects.findUnassigned(scope), ProjectErrors.NOT_FOUND, {
      detail: 'No Unassigned project is visible',
    });
  }
}

/** An archived project is not one new work can be listed under, so it reads as absent. */
function active(found: Option<ProjectEntity>): Option<ProjectEntity> {
  return found.isSome() && found.unwrap().isArchived ? None : found;
}
