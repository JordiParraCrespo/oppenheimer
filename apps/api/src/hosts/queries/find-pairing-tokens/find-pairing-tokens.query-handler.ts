import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import type { HostPairingTokenEntity } from '../../domain/host-pairing-token.entity';
import { HOST_PAIRING_TOKEN_REPOSITORY } from '../../hosts.di-tokens';
import { FindPairingTokensQuery } from './find-pairing-tokens.query';

@QueryHandler(FindPairingTokensQuery)
export class FindPairingTokensQueryHandler
  implements IQueryHandler<FindPairingTokensQuery, HostPairingTokenEntity[]>
{
  constructor(
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
  ) {}

  async execute(query: FindPairingTokensQuery): Promise<HostPairingTokenEntity[]> {
    return this.tokens.findAll(query.scope);
  }
}
