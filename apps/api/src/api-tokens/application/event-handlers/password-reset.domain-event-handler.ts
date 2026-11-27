import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PasswordResetDomainEvent } from '../../../auth/domain/events/password-reset.domain-event';
import { API_TOKEN_REPOSITORY } from '../../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';

/**
 * A password reset takes back every token the account minted before it: the
 * reset is how a real owner recovers an address someone else registered first,
 * and a token that survived it would keep that someone in. Each token is
 * revoked as `RevokeApiTokenCommand` would, so each raises
 * `ApiTokenRevokedDomainEvent` and its cached delegated session goes too.
 *
 * Only tokens minted up to the reset: the event is delivered at least once,
 * and a redelivery must not take a token the owner made afterwards.
 */
@Injectable()
export class PasswordResetDomainEventHandler {
  private readonly logger = new Logger(PasswordResetDomainEventHandler.name);

  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokens: ApiTokenRepositoryPort,
  ) {}

  @OnEvent(PasswordResetDomainEvent.name)
  async handle(event: PasswordResetDomainEvent): Promise<void> {
    const revoked = await this.apiTokens.revokeIssuedBefore(
      event.userId,
      new Date(event.resetAt),
      new Date(),
    );
    this.logger.log({
      message: 'Revoked API tokens after a password reset',
      userId: event.userId,
      revoked,
    });
  }
}
