import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ungrantableScopes } from '@oppenheimer/shared';
import type { CredentialOwnerPort } from '../../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../../auth/auth.di-tokens';
import { AuthErrors } from '../../../auth/domain/auth.errors';
import { mayIssueCredential } from '../../../auth/domain/credential-issuance.policy';
import { AbilityFactory } from '../../../roles/application/ability.factory';
import { API_TOKEN_REPOSITORY, ORGANIZATION_MEMBERSHIP_READER } from '../../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';
import type { OrganizationMembershipReaderPort } from '../../database/organization-membership.repository.port';
import { ApiTokenEntity } from '../../domain/api-token.entity';
import { ApiTokenErrors } from '../../domain/api-token.errors';
import { exceedsMintingCredential } from '../../domain/minting-reach.policy';
import { CreateApiTokenCommand } from './create-api-token.command';

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
 * The guard that admitted this request has already confirmed the caller may
 * create tokens at all. This handler enforces the rule that makes scoped
 * credentials safe: **a token may never carry more reach than its creator**.
 * The creator's effective ability is rebuilt here from their roles rather than
 * trusted from the request, and every requested scope is checked against it.
 * Before any of that, the creator must have proven their email address: a
 * token outlives a password reset's sign-out, so one minted on an address the
 * account never proved would survive its real owner recovering it.
 */
@CommandHandler(CreateApiTokenCommand)
export class CreateApiTokenCommandHandler
  implements ICommandHandler<CreateApiTokenCommand, CreateApiTokenResult>
{
  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokenRepository: ApiTokenRepositoryPort,
    @Inject(ORGANIZATION_MEMBERSHIP_READER)
    private readonly memberships: OrganizationMembershipReaderPort,
    private readonly abilityFactory: AbilityFactory,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
  ) {}

  async execute(command: CreateApiTokenCommand): Promise<CreateApiTokenResult> {
    // Read fresh rather than off the request: the session cache holds a copy
    // of the user, and a stale "verified" must not mint.
    const owner = await this.owners.requireActiveOwner(command.actor.id);
    if (!mayIssueCredential(owner)) throw new AppError(AuthErrors.EMAIL_VERIFICATION_REQUIRED);

    const ability = await this.abilityFactory.createForUser(
      { id: command.actor.id, role: command.actor.role },
      { organizationId: command.actor.organizationId ?? null },
    );

    const beyondCredential = exceedsMintingCredential(command.actor.credential, command);
    const exceeded = [
      ...new Set([...ungrantableScopes(ability, command.scopes), ...beyondCredential.scopes]),
    ];
    if (exceeded.length > 0) {
      throw new AppError(ApiTokenErrors.SCOPES_EXCEED_GRANTER, {
        detail: `The caller may not grant: ${exceeded.join(', ')}`,
        extensions: { ungrantableScopes: exceeded },
      });
    }

    if (beyondCredential.leavesOrganizations) {
      throw new AppError(ApiTokenErrors.SCOPES_EXCEED_GRANTER, {
        detail: 'A token minted with a token must be pinned within its organizations',
        extensions: { ungrantableScopes: [] },
      });
    }
    await this.assertMemberOfRequestedOrganizations(command);

    const { token, secret } = ApiTokenEntity.issue({
      userId: command.actor.id,
      name: command.name,
      scopes: command.scopes,
      organizationIds: command.organizationIds,
      ipAllowlist: command.ipAllowlist,
      expiresInDays: command.expiresInDays,
    });

    const outcome = await this.apiTokenRepository.insertWithinLimit(
      token,
      MAX_ACTIVE_TOKENS_PER_USER,
      new Date(),
    );
    if (outcome === 'limit_reached') throw new AppError(ApiTokenErrors.LIMIT_REACHED);

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
