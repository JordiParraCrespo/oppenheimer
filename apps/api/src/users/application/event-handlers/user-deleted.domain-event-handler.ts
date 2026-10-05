import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserDeletedDomainEvent } from '../../domain/events/user-deleted.domain-event';

/**
 * Only logs: what goes with the account is erased by `DeleteUserCommandHandler`
 * (`AccountErasureRegistry`, then the user row's cascade) before this runs.
 */
@Injectable()
export class UserDeletedDomainEventHandler {
  private readonly logger = new Logger(UserDeletedDomainEventHandler.name);

  @OnEvent(UserDeletedDomainEvent.name)
  handle(event: UserDeletedDomainEvent): void {
    this.logger.log(`User deleted: ${event.aggregateId} (${event.email})`);
  }
}
