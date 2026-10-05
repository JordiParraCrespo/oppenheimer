import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ExternalEventSourceRegistry } from '../../application/external-event-source.registry';
import type { InboundEventRepositoryPort } from '../../database/inbound-event.repository.port';
import { InboundEventErrors } from '../../domain/inbound-events.errors';
import { INBOUND_EVENT_REPOSITORY } from '../../inbound-events.di-tokens';
import { ReceiveInboundDeliveryCommand } from './receive-inbound-delivery.command';

export type ReceiveOutcome = 'stored' | 'duplicate' | 'ignored';

/**
 * Accept fast, process later. The delivery is stored with the job that owes its
 * processing and the provider gets its 2xx in one round trip; nothing is
 * interpreted here, so a slow tenant lookup or a normalizer bug can never make
 * the provider retry. An event name the source does not turn into any catalog
 * event is acknowledged and not stored.
 */
@CommandHandler(ReceiveInboundDeliveryCommand)
export class ReceiveInboundDeliveryCommandHandler
  implements ICommandHandler<ReceiveInboundDeliveryCommand, ReceiveOutcome>
{
  private readonly logger = new Logger(ReceiveInboundDeliveryCommandHandler.name);

  constructor(
    private readonly sources: ExternalEventSourceRegistry,
    @Inject(INBOUND_EVENT_REPOSITORY)
    private readonly store: InboundEventRepositoryPort,
  ) {}

  async execute(command: ReceiveInboundDeliveryCommand): Promise<ReceiveOutcome> {
    const source = this.sources.find(command.source);
    if (!source) throw new AppError(InboundEventErrors.UNKNOWN_SOURCE);
    if (!command.deliveryId) throw new AppError(InboundEventErrors.DELIVERY_ID_MISSING);
    if (!source.accepts(command.eventName)) {
      this.logger.debug({
        message: 'Dropped a delivery whose event no trigger listens to',
        source: command.source,
        eventName: command.eventName,
      });
      return 'ignored';
    }
    const stored = await this.store.receive({
      source: command.source,
      deliveryId: command.deliveryId,
      eventName: command.eventName,
      payload: command.payload,
      payloadDigest: command.payloadDigest,
    });
    return stored ? 'stored' : 'duplicate';
  }
}
