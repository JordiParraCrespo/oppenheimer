import { Injectable } from '@nestjs/common';
import type { ExternalEventSourcePort } from '../../inbound-events/application/external-event-source.port';
import type {
  ExternalEvent,
  InboundDelivery,
} from '../../inbound-events/domain/external-event.types';
import { normalizeSentryDelivery, SENTRY_WEBHOOK_EVENTS } from './sentry-event-normalizer.util';

/**
 * Sentry, as a source of the inbound-events hub. The webhook slice has
 * already checked the signature with the connection's secret and named the
 * workspace in the stored payload; this says what a delivery means in the
 * catalog's words.
 */
@Injectable()
export class SentryEventSource implements ExternalEventSourcePort {
  readonly id = 'sentry' as const;

  accepts(eventName: string): boolean {
    return SENTRY_WEBHOOK_EVENTS.includes(eventName);
  }

  async resolveTenants(delivery: InboundDelivery): Promise<string[]> {
    const organizationId = delivery.payload.organizationId;
    return typeof organizationId === 'string' && organizationId ? [organizationId] : [];
  }

  normalize(delivery: InboundDelivery): ExternalEvent[] {
    return normalizeSentryDelivery(delivery);
  }
}
