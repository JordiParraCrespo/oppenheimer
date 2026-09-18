import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ROLES } from '@oppenheimer/shared';
import type { RoleRepositoryPort } from '../../../roles/database/role.repository.port';
import { missingSystemRole } from '../../../roles/missing-system-role';
import { ROLE_REPOSITORY } from '../../../roles/roles.di-tokens';
import type { PersonalWorkspaceRepositoryPort } from '../../database/personal-workspace.repository.port';
import { PersonalWorkspaceEntity } from '../../domain/personal-workspace.entity';
import { PERSONAL_WORKSPACE_REPOSITORY } from '../../organizations.di-tokens';
import { ProvisionPersonalWorkspaceCommand } from './provision-personal-workspace.command';

/**
 * Creates the personal workspace a new account lives in: one organization with
 * the account as its single owner, plus the org-scoped `owner` application role
 * that opens it. No team, no roster, no invitation — the MVP is one user per
 * workspace (`product/versions/mvp/00-scope.md`).
 *
 * Answers the new organization's id, or `null` when the account already
 * belonged to one and nothing was written. "Already had one" is a success for
 * every caller: sign-up and the seed both provision, and the seed is also the
 * repair path for an account whose sign-up hook did not land.
 *
 * The decision not to write is the repository's, inside the transaction that
 * would have done it — a check here could only be stale by the time the write
 * ran.
 */
@CommandHandler(ProvisionPersonalWorkspaceCommand)
export class ProvisionPersonalWorkspaceService
  implements ICommandHandler<ProvisionPersonalWorkspaceCommand, AggregateID | null>
{
  constructor(
    @Inject(PERSONAL_WORKSPACE_REPOSITORY)
    private readonly workspaces: PersonalWorkspaceRepositoryPort,
    @Inject(ROLE_REPOSITORY)
    private readonly roles: RoleRepositoryPort,
  ) {}

  async execute(command: ProvisionPersonalWorkspaceCommand): Promise<AggregateID | null> {
    // The global `owner` role, not one scoped to an organization: it is the
    // system role the migration installs, granted *into* the new workspace.
    const ownerRole = await this.roles.findOneByName(ROLES.OWNER, null);
    if (ownerRole.isNone()) throw missingSystemRole(ROLES.OWNER, command.userId);

    const workspace = PersonalWorkspaceEntity.provisionFor({
      ownerId: command.userId,
      ownerEmail: command.email,
      ownerName: command.name,
      ownerRoleId: ownerRole.unwrap().id,
    });

    return (await this.workspaces.provision(workspace)) ? workspace.id : null;
  }
}
