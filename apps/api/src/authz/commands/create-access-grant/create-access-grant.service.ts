import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { canGrantScope, ResourceRegistry } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ACCESS_GRANT_REPOSITORY } from '../../authz.di-tokens';
import type { AccessGrantRepositoryPort } from '../../database/access-grant.repository.port';
import { AccessGrantEntity } from '../../domain/access-grant.entity';
import { AccessGrantErrors } from '../../domain/access-grant.errors';
import { PrincipalResidencyChecker } from '../../services/principal-residency.checker';
import { CreateAccessGrantCommand } from './create-access-grant.command';

/**
 * Issues an access grant, subject to two checks in this order:
 *
 * 1. **Containment** — the granter may only pass on reach they already hold.
 *    Without it these endpoints are a self-service escalation path, which is
 *    why they could not ship before the check did.
 * 2. **Principal residency** — the user, team or role must belong to the
 *    organization, or a grant could name an outsider and bridge two tenants.
 */
@CommandHandler(CreateAccessGrantCommand)
export class CreateAccessGrantService
  implements ICommandHandler<CreateAccessGrantCommand, AggregateID>
{
  private readonly logger = new Logger(CreateAccessGrantService.name);

  constructor(
    @Inject(ACCESS_GRANT_REPOSITORY)
    private readonly grants: AccessGrantRepositoryPort,
    private readonly residency: PrincipalResidencyChecker,
    private readonly registry: ResourceRegistry,
  ) {}

  async execute(command: CreateAccessGrantCommand): Promise<AggregateID> {
    const { scope } = command;
    if (!scope.organizationId) {
      throw new AppError(AccessGrantErrors.NO_ACTIVE_ORGANIZATION);
    }

    // An unknown subject is a warning, not a rejection: the catalog is
    // advisory and an admin may grant over a resource this deployment has not
    // declared. It is worth saying out loud though, because the usual cause is
    // a typo that will silently never match a row.
    if (!this.registry.get(command.resourceType)) {
      this.logger.warn({
        message: 'Access grant references an unregistered resource type',
        resourceType: command.resourceType,
      });
    }

    const resourceId = command.resourceId ?? null;

    const allowed = canGrantScope(scope, {
      organizationId: scope.organizationId,
      resourceType: command.resourceType,
      resourceId,
    });
    if (!allowed) {
      throw new AppError(AccessGrantErrors.NOT_GRANTABLE, {
        detail:
          resourceId === null
            ? `Granting every ${command.resourceType} requires holding every ${command.resourceType}`
            : `You do not hold ${command.resourceType} ${resourceId}`,
      });
    }

    await this.residency.assertBelongs(
      scope.organizationId,
      command.principalType,
      command.principalId,
    );

    const grant = AccessGrantEntity.issue({
      organizationId: scope.organizationId,
      principalType: command.principalType,
      principalId: command.principalId,
      resourceType: command.resourceType,
      resourceId,
      grantedBy: scope.userId,
      expiresAt: command.expiresAt ? new Date(command.expiresAt) : null,
    });

    await this.grants.insert(grant);
    return grant.id;
  }
}
