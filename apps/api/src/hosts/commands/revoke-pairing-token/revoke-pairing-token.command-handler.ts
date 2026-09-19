import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_PAIRING_TOKEN_REPOSITORY } from '../../hosts.di-tokens';
import { RevokePairingTokenCommand } from './revoke-pairing-token.command';

/**
 * Revokes a pairing token: one column, and the record stays so the history of
 * what was minted from where survives.
 *
 * That column is the whole of revocation, because the redemption statement
 * requires `revokedAt IS NULL` — a token revoked here cannot be spent even by
 * someone holding the secret.
 */
@CommandHandler(RevokePairingTokenCommand)
export class RevokePairingTokenCommandHandler
  implements ICommandHandler<RevokePairingTokenCommand, AggregateID>
{
  constructor(
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
  ) {}

  async execute(command: RevokePairingTokenCommand): Promise<AggregateID> {
    const found = await this.tokens.findOneById(command.scope, command.tokenId);
    if (found.isNone()) {
      throw new AppError(HostErrors.PAIRING_TOKEN_NOT_FOUND, {
        detail: `No pairing token with id ${command.tokenId}`,
      });
    }

    const token = found.unwrap();
    // Revoking twice is the same state as revoking once, and a caller who
    // clicked twice has done nothing wrong.
    token.revoke();
    await this.tokens.save(token);

    return token.id;
  }
}
