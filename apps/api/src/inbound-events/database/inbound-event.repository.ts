import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, Repository } from 'typeorm';
import type { RecentEventsQuery } from '../application/inbound-event-lookup.port';
import { ExternalEventReceivedDomainEvent } from '../domain/events/external-event-received.domain-event';
import type {
  ExternalEvent,
  InboundDelivery,
  StoredExternalEvent,
} from '../domain/external-event.types';
import { InboundEventMapper } from '../inbound-event.mapper';
import { InboundDeliveryOrmEntity } from './inbound-delivery.orm-entity';
import { InboundEventOrmEntity } from './inbound-event.orm-entity';
import type { InboundEventRepositoryPort, NewDelivery } from './inbound-event.repository.port';

/** The job name the hub's worker runs a stored delivery under. */
export const PROCESS_DELIVERY_JOB = 'process';

/**
 * The hub's store. Every write that owes work stages it on the outbox in the
 * same transaction: a delivery and the job to process it, an event and the
 * notification its consumers are owed. Nothing is ever half-received.
 */
@Injectable()
export class InboundEventRepository implements InboundEventRepositoryPort {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InboundEventOrmEntity)
    private readonly events: Repository<InboundEventOrmEntity>,
    private readonly outbox: OutboxService,
    private readonly mapper: InboundEventMapper,
  ) {}

  async receive(delivery: NewDelivery): Promise<boolean> {
    const received = await this.dataSource.transaction(async (manager) => {
      const inserted: { id: string }[] = await manager.query(
        `INSERT INTO "inbound_delivery" ("source", "deliveryId", "eventName", "payload")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("source", "deliveryId") DO NOTHING
         RETURNING "id"`,
        [delivery.source, delivery.deliveryId, delivery.eventName, delivery.payload],
      );
      if (inserted.length === 0) return false;
      await this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.INBOUND_EVENTS,
        jobName: PROCESS_DELIVERY_JOB,
        payload: { inboundDeliveryId: inserted[0].id },
        reason: `${delivery.source} delivery ${delivery.deliveryId} (${delivery.eventName}) is stored and owes normalizing`,
        aggregateId: inserted[0].id,
      });
      return true;
    });
    if (received) await this.outbox.wake();
    return received;
  }

  async findDelivery(id: string): Promise<Option<InboundDelivery>> {
    const record = await this.dataSource.getRepository(InboundDeliveryOrmEntity).findOneBy({ id });
    return record ? Some(this.mapper.deliveryToDomain(record)) : None;
  }

  async recordProcessed(
    delivery: InboundDelivery,
    organizationIds: readonly string[],
    events: readonly ExternalEvent[],
  ): Promise<number> {
    const stored = await this.dataSource.transaction(async (manager) => {
      const notifications: ExternalEventReceivedDomainEvent[] = [];
      for (const organizationId of organizationIds) {
        for (const event of events) {
          const inserted: { id: string }[] = await manager.query(
            `INSERT INTO "inbound_event"
               ("organizationId", "inboundDeliveryId", "source", "externalId", "eventType",
                "subjectKind", "subjectRef", "actorLogin", "actorIsOwnApp", "attributes",
                "context", "schemaVersion", "occurredAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT ("organizationId", "source", "externalId") DO NOTHING
             RETURNING "id"`,
            [
              organizationId,
              delivery.id,
              event.source,
              event.externalId,
              event.type,
              event.subject.kind,
              event.subject.ref,
              event.actor.login,
              event.actor.isOwnApp,
              event.attributes,
              { ...event.context, subjectName: event.subject.name },
              event.schemaVersion,
              event.occurredAt,
            ],
          );
          if (inserted.length === 0) continue;
          notifications.push(
            new ExternalEventReceivedDomainEvent({
              aggregateId: inserted[0].id,
              reason: `a ${event.source} ${event.type} on ${event.subject.name} was stored and its consumers are owed it`,
              organizationId,
              source: event.source,
              eventType: event.type,
              subjectKind: event.subject.kind,
              subjectRef: event.subject.ref,
              actorLogin: event.actor.login,
              actorIsOwnApp: event.actor.isOwnApp,
              attributes: event.attributes,
              externalId: event.externalId,
              occurredAt: event.occurredAt.toISOString(),
            }),
          );
        }
      }
      await manager.query(
        `UPDATE "inbound_delivery"
            SET "status" = 'processed', "processedAt" = now(), "lastError" = NULL,
                "eventCount" = $2
          WHERE "id" = $1`,
        [delivery.id, notifications.length],
      );
      await this.outbox.stageEvents(manager, notifications);
      return notifications.length;
    });
    if (stored > 0) await this.outbox.wake();
    return stored;
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "inbound_delivery" SET "status" = 'failed', "lastError" = $2 WHERE "id" = $1`,
      [id, error.slice(0, 2000)],
    );
  }

  async findOne(organizationId: string, id: string): Promise<Option<StoredExternalEvent>> {
    const record = await this.events.findOneBy({ organizationId, id });
    return record ? Some(this.mapper.eventToDomain(record)) : None;
  }

  async findRecent(query: RecentEventsQuery): Promise<StoredExternalEvent[]> {
    if (query.subjectRefs.length === 0) return [];
    // IDX_inbound_event_preview: equality on the tenant, source and type, the
    // subject set, then the time range.
    const records = await this.events
      .createQueryBuilder('event')
      .where('event.organizationId = :organizationId', { organizationId: query.organizationId })
      .andWhere('event.source = :source', { source: query.source })
      .andWhere('event.eventType = :eventType', { eventType: query.eventType })
      .andWhere('event.subjectRef IN (:...subjectRefs)', { subjectRefs: [...query.subjectRefs] })
      .andWhere('event.occurredAt >= :since', { since: query.since })
      .orderBy('event.occurredAt', 'DESC')
      .limit(query.limit)
      .getMany();
    return records.map((record) => this.mapper.eventToDomain(record));
  }

  async deleteDeliveriesBefore(cutoff: Date, batch: number): Promise<number> {
    return this.deleteBatch('inbound_delivery', cutoff, batch);
  }

  async deleteEventsBefore(cutoff: Date, batch: number): Promise<number> {
    return this.deleteBatch('inbound_event', cutoff, batch);
  }

  /**
   * One batch through the BRIN index, touching only the rows it picked
   * (`.agents/rules/database-design.md`, batched deletes).
   */
  private async deleteBatch(table: string, cutoff: Date, batch: number): Promise<number> {
    const [, affected]: [unknown, number] = await this.dataSource.query(
      `DELETE FROM "${table}"
        WHERE ctid = ANY (ARRAY(
          SELECT ctid FROM "${table}" WHERE "receivedAt" < $1 LIMIT $2
        ))`,
      [cutoff, batch],
    );
    return affected ?? 0;
  }
}
