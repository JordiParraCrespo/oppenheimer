import { Injectable } from '@nestjs/common';
import { isExternalTriggerSource } from '@oppenheimer/shared/automations';
import type { InboundDeliveryOrmEntity } from './database/inbound-delivery.orm-entity';
import type { InboundEventOrmEntity } from './database/inbound-event.orm-entity';
import type {
  ExternalEventContext,
  InboundDelivery,
  StoredExternalEvent,
} from './domain/external-event.types';

/** Translates the hub's two rows into the shapes the domain and its consumers read. */
@Injectable()
export class InboundEventMapper {
  deliveryToDomain(record: InboundDeliveryOrmEntity): InboundDelivery {
    if (!isExternalTriggerSource(record.source)) {
      throw new Error(`Delivery ${record.id} names an unknown source ${record.source}`);
    }
    return {
      id: record.id,
      source: record.source,
      deliveryId: record.deliveryId,
      eventName: record.eventName,
      payload: record.payload,
      receivedAt: new Date(record.receivedAt),
    };
  }

  eventToDomain(record: InboundEventOrmEntity): StoredExternalEvent {
    if (!isExternalTriggerSource(record.source)) {
      throw new Error(`Event ${record.id} names an unknown source ${record.source}`);
    }
    const subjectName = record.context?.subjectName;
    return {
      id: record.id,
      organizationId: record.organizationId,
      source: record.source,
      type: record.eventType,
      externalId: record.externalId,
      subject: {
        kind: 'repository',
        ref: record.subjectRef,
        name: typeof subjectName === 'string' ? subjectName : record.subjectRef,
      },
      actor: { login: record.actorLogin, isOwnApp: record.actorIsOwnApp },
      attributes: record.attributes as StoredExternalEvent['attributes'],
      context: record.context as ExternalEventContext,
      occurredAt: new Date(record.occurredAt),
      receivedAt: new Date(record.receivedAt),
      schemaVersion: record.schemaVersion,
    };
  }
}
