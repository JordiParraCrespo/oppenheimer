import { Inject, Injectable } from '@nestjs/common';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import type { AccountErasurePort } from '../../users/application/account-erasure.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * What deleting an account does to its sessions: removes those of the
 * workspace it owns. They were stopped a step earlier, when the hosts they
 * ran on were unpaired.
 */
@Injectable()
export class SessionAccountErasure implements AccountErasurePort {
  readonly step = 'sessions' as const;

  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async eraseFor(userId: string): Promise<void> {
    for (const workspaceId of await this.workspaces.ownedBy(userId)) {
      await this.sessions.eraseWorkspace(workspaceId);
    }
  }
}
