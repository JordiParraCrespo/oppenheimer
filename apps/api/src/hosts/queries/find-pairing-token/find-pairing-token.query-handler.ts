import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import type { HostPairingTokenEntity } from '../../domain/host-pairing-token.entity';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_PAIRING_TOKEN_REPOSITORY } from '../../hosts.di-tokens';
import { FindPairingTokenQuery } from './find-pairing-token.query';

@QueryHandler(FindPairingTokenQuery)
export class FindPairingTokenQueryHandler
  implements IQueryHandler<FindPairingTokenQuery, HostPairingTokenEntity>
{
  constructor(
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
  ) {}

  async execute(query: FindPairingTokenQuery): Promise<HostPairingTokenEntity> {
    const found = await this.tokens.findOneById(query.scope, query.tokenId);
    // Someone else's token reads as missing: the scoped query cannot see it, and
    // saying so would confirm the id.
    if (found.isNone()) {
      throw new AppError(HostErrors.PAIRING_TOKEN_NOT_FOUND, {
        detail: `No pairing token with id ${query.tokenId}`,
      });
    }
    return found.unwrap();
  }
}
