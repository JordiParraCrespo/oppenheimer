import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserDeletedDomainEvent } from '../../domain/events/user-deleted.domain-event';

/**
 * Reacts to user deletion. Kept intentionally small — downstream cleanup
 * (revoking sessions, purging files, analytics) hangs off this handler so the
 * deletion flow stays decoupled from those concerns.
 */
@Injectable()
export class UserDeletedDomainEventHandler {
  private readonly logger = new Logger(UserDeletedDomainEventHandler.name);

  @OnEvent(UserDeletedDomainEvent.name)
  handle(event: UserDeletedDomainEvent): void {
    this.logger.log(`User deleted: ${event.aggregateId} (${event.email})`);
  }
}
