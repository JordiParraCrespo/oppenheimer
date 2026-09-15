import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { API_TOKEN_REPOSITORY } from '../../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';
import { ApiTokenErrors } from '../../domain/api-token.errors';
import { RevokeApiTokenCommand } from './revoke-api-token.command';

/**
 * Revokes a token. The record is kept (revoked, not deleted) so the audit trail
 * survives. Revoking raises `ApiTokenRevokedDomainEvent`, which the auth layer
 * handles by dropping the credential's cached delegated session — so revocation
 * takes effect immediately rather than at the end of that window.
 */
@CommandHandler(RevokeApiTokenCommand)
export class RevokeApiTokenService implements ICommandHandler<RevokeApiTokenCommand, AggregateID> {
  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokens: ApiTokenRepositoryPort,
  ) {}

  async execute(command: RevokeApiTokenCommand): Promise<AggregateID> {
    const found = await this.apiTokens.findOneById(command.tokenId);
    if (found.isNone()) throw new AppError(ApiTokenErrors.NOT_FOUND);

    const token = found.unwrap();
    // Someone else's token is reported as missing, not forbidden — ids stay
    // unprobeable.
    if (token.userId !== command.userId) throw new AppError(ApiTokenErrors.NOT_FOUND);

    token.revoke();
    await this.apiTokens.save(token);

    return token.id;
  }
}
