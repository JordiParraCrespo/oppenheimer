import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, Repository } from 'typeorm';
import type { MatchingEvents, MatchingEventsQuery } from '../application/inbound-event-lookup.port';
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
  private readonly logger = new Logger(InboundEventRepository.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InboundEventOrmEntity)
    private readonly events: Repository<InboundEventOrmEntity>,
    private readonly outbox: OutboxService,
    private readonly mapper: InboundEventMapper,
  ) {}

  async receive(delivery: NewDelivery): Promise<boolean> {
    const received = await this.outbox.transaction(async (manager) => {
      // A bare ON CONFLICT covers both uniques: `(source, deliveryId)`, a
      // provider's retry, and `(source, payloadDigest)`, the same signed bytes
      // under a delivery id the provider never sent (a replay). Either is a no-op.
      const inserted: { id: string }[] = await manager.query(
        `INSERT INTO "inbound_delivery"
           ("source", "deliveryId", "eventName", "payload", "payloadDigest")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING "id"`,
        [
          delivery.source,
          delivery.deliveryId,
          delivery.eventName,
          delivery.payload,
          delivery.payloadDigest,
        ],
      );
      if (inserted.length === 0) return false;
      await this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.INBOUND_EVENTS,
        jobName: PROCESS_DELIVERY_JOB,
        payload: { inboundDeliveryId: inserted[0].id },
        reason: `${delivery.source} delivery ${delivery.deliveryId} (${delivery.eventName}) is stored and owes normalizing`,
        aggregateId: inserted[0].id,
        correlationId: delivery.correlationId,
      });
      return true;
    });
    if (!received) await this.reportReplay(delivery);
    return received;
  }

  /**
   * Only on a refused insert, so the path every delivery takes is unchanged:
   * a stored row with these bytes under another id means someone replayed a
   * signed body, which a provider's own retry never does.
   */
  private async reportReplay(delivery: NewDelivery): Promise<void> {
    const rows: { deliveryId: string }[] = await this.dataSource.query(
      `SELECT "deliveryId" FROM "inbound_delivery"
        WHERE "source" = $1 AND "payloadDigest" = $2 LIMIT 1`,
      [delivery.source, delivery.payloadDigest],
    );
    const original = rows[0]?.deliveryId;
    if (original && original !== delivery.deliveryId) {
      this.logger.warn({
        message: 'Dropped a replayed delivery: these signed bytes were already received',
        source: delivery.source,
        deliveryId: delivery.deliveryId,
        originalDeliveryId: original,
      });
    }
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
    return this.outbox.transaction(async (manager) => {
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
      // Served by IDX_inbound_event_delivery, in this transaction, so the count
      // sees this run's rows too.
      await manager.query(
        `UPDATE "inbound_delivery" d
            SET "status" = 'processed', "processedAt" = now(), "lastError" = NULL,
                "eventCount" = (SELECT count(*) FROM "inbound_event" e
                                 WHERE e."inboundDeliveryId" = d."id")
          WHERE d."id" = $1`,
        [delivery.id],
      );
      await this.outbox.stageEvents(manager, notifications);
      return notifications.length;
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "inbound_delivery" SET "status" = 'failed', "lastError" = $2 WHERE "id" = $1`,
      [id, error.slice(0, 2000)],
    );
  }

  async restageUnprocessed(
    staleBefore: Date,
    abandonBefore: Date,
    batch: number,
  ): Promise<{ restaged: number; abandoned: number }> {
    return this.outbox.transaction(async (manager) => {
      // Both statements are destructured: TypeORM hands an UPDATE's result
      // back as `[rows, affected]` and only a SELECT's as the rows themselves
      // (`PostgresQueryRunner.query`); the regression is
      // `inbound-event-restage-unprocessed.repository.spec.ts`.
      const [abandoned]: [{ id: string }[], number] = await manager.query(
        `UPDATE "inbound_delivery"
            SET "status" = 'failed', "lastError" = 'not processed after its retries and a day of sweeps'
          WHERE "status" = 'received' AND "receivedAt" < $1
          RETURNING "id"`,
        [abandonBefore],
      );
      // IDX_inbound_delivery_unprocessed; SKIP LOCKED so two replicas sweep
      // disjoint rows.
      const [due]: [{ id: string; source: string; deliveryId: string }[], number] =
        await manager.query(
          `UPDATE "inbound_delivery" d SET "restagedAt" = now()
           FROM (SELECT "id" FROM "inbound_delivery"
                  WHERE "status" = 'received' AND "receivedAt" < $1
                    AND ("restagedAt" IS NULL OR "restagedAt" < $1)
                  ORDER BY "receivedAt" LIMIT $2 FOR UPDATE SKIP LOCKED) due
          WHERE d."id" = due."id"
          RETURNING d."id", d."source", d."deliveryId"`,
          [staleBefore, batch],
        );
      for (const row of due) {
        await this.outbox.stageJob(manager, {
          queue: QUEUE_NAMES.INBOUND_EVENTS,
          jobName: PROCESS_DELIVERY_JOB,
          payload: { inboundDeliveryId: row.id },
          reason: `${row.source} delivery ${row.deliveryId} was still unprocessed at the sweep`,
          aggregateId: row.id,
          // A sweep: no request owes this job, so it carries no correlation.
          correlationId: null,
        });
      }
      return { restaged: due.length, abandoned: abandoned.length };
    });
  }

  async findOne(organizationId: string, id: string): Promise<Option<StoredExternalEvent>> {
    const record = await this.events.findOneBy({ organizationId, id });
    return record ? Some(this.mapper.eventToDomain(record)) : None;
  }

  async findMatching(query: MatchingEventsQuery): Promise<MatchingEvents> {
    if (query.subjectRefs.length === 0) return { count: 0, sample: [] };
    // IDX_inbound_event_preview: equality on the tenant, source and type, the
    // subject set, then the time range; the filter and our own App's events
    // are applied on those rows, in the database, so the count is exact.
    const matching = () => {
      const builder = this.events
        .createQueryBuilder('event')
        .where('event.organizationId = :organizationId', { organizationId: query.organizationId })
        .andWhere('event.source = :source', { source: query.source })
        .andWhere('event.eventType = :eventType', { eventType: query.eventType })
        .andWhere('event.subjectRef IN (:...subjectRefs)', { subjectRefs: [...query.subjectRefs] })
        .andWhere('event.occurredAt >= :since', { since: query.since })
        .andWhere('event.actorIsOwnApp = false');
      if (query.attribute) {
        // `matchesTriggerFilter`'s rule: the value itself, or one of a list's.
        builder.andWhere(
          `(event.attributes ->> :field = :value
            OR (jsonb_typeof(event.attributes -> :field) = 'array'
                AND jsonb_exists(event.attributes -> :field, :value)))`,
          { field: query.attribute.field, value: query.attribute.value },
        );
      }
      return builder;
    };
    const [count, records] = await Promise.all([
      matching().getCount(),
      matching().orderBy('event.occurredAt', 'DESC').limit(query.sampleSize).getMany(),
    ]);
    return { count, sample: records.map((record) => this.mapper.eventToDomain(record)) };
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
