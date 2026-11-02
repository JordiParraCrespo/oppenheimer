import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { requireFound } from '@oppenheimer/backend-core';
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
    requireTenant(scope);

    const grant = requireFound(
      await this.grants.findOneInOrganization(scope.organizationId, command.grantId),
      AccessGrantErrors.NOT_FOUND,
      { detail: `No access grant with id ${command.grantId}` },
    );

    await this.grants.delete(grant);
  }
}
