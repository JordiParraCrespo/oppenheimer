import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { ExternalEventReceivedDomainEvent } from '../../../inbound-events/domain/events/external-event-received.domain-event';
import { FireEventTriggersCommand } from '../../commands/fire-event-triggers/fire-event-triggers.command';

/**
 * The hub stored an event: see which automations it fires. Delivered at least
 * once by the outbox; the run's cause key is the event, so a redelivery queues
 * nothing twice.
 */
@Injectable()
export class ExternalEventReceivedDomainEventHandler {
  constructor(private readonly commandBus: CommandBus) {}

  @OnEvent(ExternalEventReceivedDomainEvent.name)
  async handle(
    event: Pick<
      ExternalEventReceivedDomainEvent,
      | 'aggregateId'
      | 'organizationId'
      | 'source'
      | 'eventType'
      | 'subjectRef'
      | 'externalId'
      | 'actorIsOwnApp'
      | 'attributes'
    >,
  ): Promise<void> {
    await this.commandBus.execute(
      new FireEventTriggersCommand({
        organizationId: event.organizationId,
        inboundEventId: event.aggregateId,
        source: event.source,
        eventType: event.eventType,
        subjectRef: event.subjectRef,
        externalId: event.externalId,
        actorIsOwnApp: event.actorIsOwnApp,
        attributes: event.attributes ?? {},
      }),
    );
  }
}
