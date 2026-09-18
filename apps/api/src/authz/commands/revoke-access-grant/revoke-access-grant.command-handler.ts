import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ACCESS_GRANT_REPOSITORY } from '../../authz.di-tokens';
import type { AccessGrantRepositoryPort } from '../../database/access-grant.repository.port';
import { AccessGrantErrors } from '../../domain/access-grant.errors';
import { RevokeAccessGrantCommand } from './revoke-access-grant.command';

@CommandHandler(RevokeAccessGrantCommand)
export class RevokeAccessGrantCommandHandler
  implements ICommandHandler<RevokeAccessGrantCommand, void>
{
  constructor(
    @Inject(ACCESS_GRANT_REPOSITORY)
    private readonly grants: AccessGrantRepositoryPort,
  ) {}

  async execute(command: RevokeAccessGrantCommand): Promise<void> {
    const { scope } = command;
    if (!scope.organizationId) {
      throw new AppError(AccessGrantErrors.NO_ACTIVE_ORGANIZATION);
    }

    // Scoped to the organization, so a grant in another tenant reports as not
    // found rather than forbidden — ids stay un-probeable.
    const found = await this.grants.findOneInOrganization(scope.organizationId, command.grantId);
    if (found.isNone()) {
      throw new AppError(AccessGrantErrors.NOT_FOUND, {
        detail: `No access grant with id ${command.grantId}`,
      });
    }

    await this.grants.delete(found.unwrap());
  }
}
