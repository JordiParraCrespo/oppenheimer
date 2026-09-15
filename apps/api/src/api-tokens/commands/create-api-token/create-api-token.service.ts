import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ungrantableScopes } from '@oppenheimer/shared';
import { AbilityFactory } from '../../../roles/services/ability.factory';
import { API_TOKEN_REPOSITORY, ORGANIZATION_MEMBERSHIP_READER } from '../../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';
import type { OrganizationMembershipReaderPort } from '../../database/organization-membership.repository.port';
import { ApiTokenEntity } from '../../domain/api-token.entity';
import { ApiTokenErrors } from '../../domain/api-token.errors';
import { CreateApiTokenCommand } from './create-api-token.command';

/** How many usable tokens one user may hold at a time. */
const MAX_ACTIVE_TOKENS_PER_USER = 50;

/**
 * What the caller gets back. Commands normally return just the aggregate id,
 * but the secret exists only inside this handler — it is hashed before being
 * persisted, so no follow-up query could ever recover it.
 */
export interface CreateApiTokenResult {
  tokenId: string;
  secret: string;
}

/**
 * Mints an API token.
 *
 * The guard that admitted this request has already confirmed the caller may
 * create tokens at all. This handler enforces the rule that makes scoped
 * credentials safe: **a token may never carry more reach than its creator**.
 * The creator's effective ability is rebuilt here from their roles rather than
 * trusted from the request, and every requested scope is checked against it.
 */
@CommandHandler(CreateApiTokenCommand)
export class CreateApiTokenService
  implements ICommandHandler<CreateApiTokenCommand, CreateApiTokenResult>
{
  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokenRepository: ApiTokenRepositoryPort,
    @Inject(ORGANIZATION_MEMBERSHIP_READER)
    private readonly memberships: OrganizationMembershipReaderPort,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(command: CreateApiTokenCommand): Promise<CreateApiTokenResult> {
    const ability = await this.abilityFactory.createForUser(
      { id: command.actor.id, role: command.actor.role },
      { activeOrganizationId: command.actor.activeOrganizationId ?? null },
    );

    const exceeded = ungrantableScopes(ability, command.scopes);
    if (exceeded.length > 0) {
      throw new AppError(ApiTokenErrors.SCOPES_EXCEED_GRANTER, {
        detail: `The caller may not grant: ${exceeded.join(', ')}`,
        extensions: { ungrantableScopes: exceeded },
      });
    }

    await this.assertMemberOfRequestedOrganizations(command);

    const activeCount = await this.apiTokenRepository.countActiveForUser(
      command.actor.id,
      new Date(),
    );
    if (activeCount >= MAX_ACTIVE_TOKENS_PER_USER) {
      throw new AppError(ApiTokenErrors.LIMIT_REACHED);
    }

    const { token, secret } = ApiTokenEntity.issue({
      userId: command.actor.id,
      name: command.name,
      scopes: command.scopes,
      organizationIds: command.organizationIds,
      ipAllowlist: command.ipAllowlist,
      expiresInDays: command.expiresInDays,
    });

    await this.apiTokenRepository.insert(token);

    return { tokenId: token.id, secret };
  }

  /**
   * Restricting a token to organizations the creator has no part in would
   * either be a no-op or an attempt to probe for organization ids, so it is
   * refused outright.
   */
  private async assertMemberOfRequestedOrganizations(
    command: CreateApiTokenCommand,
  ): Promise<void> {
    if (!command.organizationIds || command.organizationIds.length === 0) return;

    const memberOf = new Set(await this.memberships.findOrganizationIdsForUser(command.actor.id));
    const foreign = command.organizationIds.filter((id) => !memberOf.has(id));
    if (foreign.length > 0) throw new AppError(ApiTokenErrors.NOT_A_MEMBER);
  }
}
