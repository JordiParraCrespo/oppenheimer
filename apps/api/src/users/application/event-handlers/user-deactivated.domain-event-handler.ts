import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserDeactivatedDomainEvent } from '../../domain/events/user-deactivated.domain-event';
import { ACCOUNT_SESSIONS } from '../../user.di-tokens';
import type { AccountSessionsPort } from '../account-sessions.port';

/**
 * Runs off the outbox, so "the flag was written" and "the revocation is owed"
 * commit together and a failed revocation is retried by the relay, and the
 * deactivation use case knows nothing about sessions. The relay hands over the
 * event's payload, a plain object, so only its fields are read.
 */
@Injectable()
export class UserDeactivatedDomainEventHandler {
  private readonly logger = new Logger(UserDeactivatedDomainEventHandler.name);

  constructor(
    @Inject(ACCOUNT_SESSIONS)
    private readonly sessions: AccountSessionsPort,
  ) {}

  // `suppressErrors: false`: the default swallows a listener's rejection, and
  // the relay would mark the row delivered with the sessions still alive.
  @OnEvent(UserDeactivatedDomainEvent.name, { suppressErrors: false })
  async handle(event: UserDeactivatedDomainEvent): Promise<void> {
    await this.sessions.revokeAll(event.aggregateId);
    this.logger.log({
      message: 'Deactivated account signed out everywhere',
      userId: event.aggregateId,
    });
  }
}
