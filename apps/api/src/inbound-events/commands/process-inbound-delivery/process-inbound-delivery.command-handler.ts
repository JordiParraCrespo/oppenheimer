import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ExternalEventSourceRegistry } from '../../application/external-event-source.registry';
import type { InboundEventRepositoryPort } from '../../database/inbound-event.repository.port';
import { isBeyondReplayWindow } from '../../domain/delivery-retention.policy';
import { INBOUND_EVENT_REPOSITORY } from '../../inbound-events.di-tokens';
import { ProcessInboundDeliveryCommand } from './process-inbound-delivery.command';

/**
 * Turn a stored delivery into canonical events, one set per workspace it
 * concerns, and publish each. Idempotent end to end: the events are keyed by
 * `(workspace, source, externalId)`, so a job the queue runs twice — or a
 * delivery an operator replays — stores and publishes nothing new.
 *
 * A delivery nobody holds (an installation no workspace has, a repository we
 * never saw) is processed to zero events, not failed: it is not going to get
 * better on retry.
 */
@CommandHandler(ProcessInboundDeliveryCommand)
export class ProcessInboundDeliveryCommandHandler
  implements ICommandHandler<ProcessInboundDeliveryCommand, number>
{
  private readonly logger = new Logger(ProcessInboundDeliveryCommandHandler.name);

  constructor(
    private readonly sources: ExternalEventSourceRegistry,
    @Inject(INBOUND_EVENT_REPOSITORY)
    private readonly store: InboundEventRepositoryPort,
  ) {}

  async execute(command: ProcessInboundDeliveryCommand): Promise<number> {
    const found = await this.store.findDelivery(command.inboundDeliveryId);
    if (found.isNone()) return 0; // purged by retention before the job ran
    const delivery = found.unwrap();

    const source = this.sources.find(delivery.source);
    if (!source) {
      await this.store.markFailed(delivery.id, `no adapter for source ${delivery.source}`);
      return 0;
    }

    let events: ReturnType<typeof source.normalize>;
    try {
      events = source.normalize(delivery);
    } catch (error) {
      // A normalizer that throws is a bug in our code, not a transient fault:
      // record it on the row, where a replay after the fix will find it.
      const message = error instanceof Error ? error.message : String(error);
      await this.store.markFailed(delivery.id, message);
      this.logger.error({
        message: 'A delivery could not be normalized',
        id: delivery.id,
        error: message,
      });
      return 0;
    }
    // A body replayed after its delivery row was purged gets past the digest;
    // an event whose own time is older than that window is dropped here.
    const fresh = events.filter((event) => !isBeyondReplayWindow(event, delivery.receivedAt));
    if (fresh.length < events.length) {
      this.logger.warn({
        message: 'Dropped events older than the replay window',
        id: delivery.id,
        dropped: events.length - fresh.length,
      });
    }
    const tenants = fresh.length > 0 ? await source.resolveTenants(delivery) : [];
    return this.store.recordProcessed(delivery, tenants, fresh);
  }
}
