import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MembershipEndedDomainEvent } from '../../../organizations/domain/events/membership-ended.domain-event';
import { API_TOKEN_REPOSITORY } from '../../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';

/**
 * Revokes the tokens a person pinned to an organization once they are no
 * longer a member of it (removed, or they left). A pinned token is a key to
 * that organization alone; left standing, it would open again the day they
 * were added back. Each revocation raises `ApiTokenRevokedDomainEvent`, whose
 * handler drops the delegated session cached for the token.
 *
 * Every pinned token still standing when this runs, including one minted
 * after the person was added back if delivery was that late: revoking one too
 * many costs a new token, leaving one open costs the organization. A token
 * already revoked is left alone, so the redelivery the outbox allows changes
 * nothing. Until this runs, `ApiTokenCredentialResolver`
 * refuses a pinned token whose owner has left the organization.
 */
@Injectable()
export class MembershipEndedDomainEventHandler {
  private readonly logger = new Logger(MembershipEndedDomainEventHandler.name);

  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokens: ApiTokenRepositoryPort,
  ) {}

  @OnEvent(MembershipEndedDomainEvent.name)
  async handle(event: Pick<MembershipEndedDomainEvent, 'aggregateId' | 'userId'>): Promise<void> {
    const revoked = await this.apiTokens.revokePinnedTo(
      event.userId,
      event.aggregateId,
      new Date(),
    );
    if (revoked.length === 0) return;
    this.logger.log({
      message: 'Revoked the API tokens pinned to an organization its owner left',
      userId: event.userId,
      organizationId: event.aggregateId,
      tokenIds: revoked,
    });
  }
}
