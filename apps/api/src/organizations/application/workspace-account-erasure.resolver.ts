import { Inject, Injectable } from '@nestjs/common';
import type { AccountErasurePort } from '../../users/application/account-erasure.port';
import type { PersonalWorkspaceRepositoryPort } from '../database/personal-workspace.repository.port';
import { PERSONAL_WORKSPACE_REPOSITORY, WORKSPACE_LOOKUP } from '../organizations.di-tokens';
import type { WorkspaceLookupPort } from './workspace-lookup.port';

/**
 * What deleting an account does to its workspace: removes the one it owns,
 * last among the contributions, once sessions and projects have taken their
 * rows out of it.
 */
@Injectable()
export class WorkspaceAccountErasure implements AccountErasurePort {
  readonly step = 'workspace' as const;

  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    @Inject(PERSONAL_WORKSPACE_REPOSITORY)
    private readonly repository: PersonalWorkspaceRepositoryPort,
  ) {}

  async eraseFor(userId: string): Promise<void> {
    await this.repository.erase(await this.workspaces.ownedBy(userId));
  }
}
