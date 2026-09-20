import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DELEGATED_SESSION } from '../../../auth/auth.di-tokens';
import type { DelegatedSessionPort } from '../../../auth/infrastructure/delegated-session.port';
import { ApiTokenRevokedDomainEvent } from '../../domain/events/api-token-revoked.domain-event';

/**
 * Drops the delegated Better Auth session cached for a revoked token.
 *
 * Without this, a revoked credential would keep working through its cached
 * session until the ten-minute window elapsed. Reacting to the domain event
 * (rather than calling the auth layer from the revoke handler) keeps the
 * revoke use case free of any knowledge of sessions, and it lives here rather
 * than in `auth` because the auth kernel does not know this module exists —
 * the credential kind is ours, and so is what its revocation costs.
 */
@Injectable()
export class ApiTokenRevokedDomainEventHandler {
  private readonly logger = new Logger(ApiTokenRevokedDomainEventHandler.name);

  constructor(
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

  @OnEvent(ApiTokenRevokedDomainEvent.name)
  async handle(event: ApiTokenRevokedDomainEvent): Promise<void> {
    await this.delegatedSessions.invalidate(event.aggregateId, event.userId);
    this.logger.log(`API token revoked: ${event.aggregateId}`);
  }
}
