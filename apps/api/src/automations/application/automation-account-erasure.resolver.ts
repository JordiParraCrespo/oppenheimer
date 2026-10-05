import { Inject, Injectable } from '@nestjs/common';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import type { AccountErasurePort } from '../../users/application/account-erasure.port';
import { AUTOMATION_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';

/**
 * What deleting an account does to automations: removes those of the workspace
 * it owns, with their runs (Settings: "removes your automations"). First in the
 * erasure order, because a revision names a host the next step erases.
 */
@Injectable()
export class AutomationAccountErasure implements AccountErasurePort {
  readonly step = 'automations' as const;

  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async eraseFor(userId: string): Promise<void> {
    for (const workspaceId of await this.workspaces.ownedBy(userId)) {
      await this.automations.eraseWorkspace(workspaceId);
    }
  }
}
