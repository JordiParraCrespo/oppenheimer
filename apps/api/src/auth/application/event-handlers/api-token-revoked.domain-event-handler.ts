import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApiTokenRevokedDomainEvent } from '../../../api-tokens/domain/events/api-token-revoked.domain-event';
import { DELEGATED_SESSION } from '../../auth.di-tokens';
import type { DelegatedSessionPort } from '../../infrastructure/delegated-session.port';

/**
 * Drops the delegated Better Auth session cached for a revoked token.
 *
 * Without this, a revoked credential would keep working through its cached
 * session until the ten-minute window elapsed. Reacting to the domain event
 * (rather than calling the auth layer from the revoke handler) keeps the API
 * tokens module free of any dependency on the auth module's internals.
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
