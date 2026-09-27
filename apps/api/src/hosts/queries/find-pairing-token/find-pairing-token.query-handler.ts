import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { type HostOverview, HostUsageRegistry } from '../../application/host-usage.registry';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import type { HostPairingTokenEntity } from '../../domain/host-pairing-token.entity';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_PAIRING_TOKEN_REPOSITORY, HOST_REPOSITORY } from '../../hosts.di-tokens';
import { FindPairingTokenQuery } from './find-pairing-token.query';

export interface PairingTokenStatus {
  token: HostPairingTokenEntity;
  /** The host the token paired, once a runner has spent it. */
  host: HostOverview | null;
}

/**
 * What Add host polls while it says "Listening for this host…".
 *
 * One read answers both halves of the dialog: whether *this* token was spent,
 * and the machine it paired as the row will show it — name, platform, the tools
 * its preflight found. The list of tokens answered the first half and left the
 * console a second request for the second; asking for the host by the token
 * also keeps "the host list grew" out of it, which an account that already
 * owns a machine answers the moment the dialog opens.
 *
 * Both reads are scoped, so a token or a host outside the caller's reach is
 * not found rather than confirmed.
 */
@QueryHandler(FindPairingTokenQuery)
export class FindPairingTokenQueryHandler
  implements IQueryHandler<FindPairingTokenQuery, PairingTokenStatus>
{
  constructor(
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    private readonly usage: HostUsageRegistry,
  ) {}

  async execute(query: FindPairingTokenQuery): Promise<PairingTokenStatus> {
    const found = await this.tokens.findOneById(query.scope, query.tokenId);
    if (found.isNone()) {
      throw new AppError(HostErrors.PAIRING_TOKEN_NOT_FOUND, {
        detail: `No pairing token with id ${query.tokenId}`,
      });
    }
    const token = found.unwrap();
    if (!token.redeemedHostId) return { token, host: null };

    const paired = await this.hosts.findOneByIdWithPresence(query.scope, token.redeemedHostId);
    if (paired.isNone()) return { token, host: null };
    const [host] = await this.usage.overview([paired.unwrap()]);
    return { token, host };
  }
}
