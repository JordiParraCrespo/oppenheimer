import { Inject, Injectable } from '@nestjs/common';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import type { AccountErasurePort } from '../../users/application/account-erasure.port';
import type { ProjectRepositoryPort } from '../database/project.repository.port';
import { PROJECT_REPOSITORY } from '../projects.di-tokens';

/** What deleting an account does to its projects: removes those of the workspace it owns. */
@Injectable()
export class ProjectAccountErasure implements AccountErasurePort {
  readonly step = 'projects' as const;

  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async eraseFor(userId: string): Promise<void> {
    for (const workspaceId of await this.workspaces.ownedBy(userId)) {
      await this.projects.eraseWorkspace(workspaceId);
    }
  }
}
