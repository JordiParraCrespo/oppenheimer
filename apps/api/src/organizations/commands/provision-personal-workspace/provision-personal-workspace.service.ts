import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ROLES } from '@oppenheimer/shared';
import type { RoleRepositoryPort } from '../../../roles/database/role.repository.port';
import { ROLE_REPOSITORY } from '../../../roles/roles.di-tokens';
import type { PersonalWorkspaceRepositoryPort } from '../../database/personal-workspace.repository.port';
import { OrganizationErrors } from '../../domain/organization.errors';
import { PersonalWorkspaceEntity } from '../../domain/personal-workspace.entity';
import { PERSONAL_WORKSPACE_REPOSITORY } from '../../organizations.di-tokens';
import { ProvisionPersonalWorkspaceCommand } from './provision-personal-workspace.command';

/**
 * Creates the personal workspace a new account lives in: one organization with
 * the account as its single owner, plus the org-scoped `owner` application role
 * that opens it. No team, no roster, no invitation — the MVP is one user per
 * workspace (`product/versions/mvp/00-scope.md`).
 *
 * Idempotent, and that is load-bearing: sign-up and the seed both provision,
 * and an account that already belongs to an organization is left alone. It
 * answers `null` in that case rather than raising, because "already had one"
 * is a success for every caller.
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
    if (await this.workspaces.belongsToAnyOrganization(command.userId)) return null;

    // The global `owner` role, not one scoped to an organization: it is the
    // system role the migration installs, granted *into* the new workspace.
    const ownerRole = await this.roles.findOneByName(ROLES.OWNER, null);
    if (ownerRole.isNone()) {
      throw new AppError(OrganizationErrors.OWNER_ROLE_MISSING, {
        detail:
          'The system role "owner" is missing, so the workspace could not be made openable. Run the migrations.',
        extensions: { userId: command.userId },
      });
    }

    const workspace = PersonalWorkspaceEntity.provisionFor({
      ownerId: command.userId,
      ownerEmail: command.email,
      ownerName: command.name,
      ownerRoleId: ownerRole.unwrap().id,
    });

    await this.workspaces.insert(workspace);
    return workspace.id;
  }
}
