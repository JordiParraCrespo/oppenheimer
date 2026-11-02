import { Injectable } from '@nestjs/common';
import type { ExternalEventSourcePort } from '../../inbound-events/application/external-event-source.port';
import type {
  ExternalEvent,
  InboundDelivery,
} from '../../inbound-events/domain/external-event.types';
import { GMAIL_DELIVERY_EVENT, normalizeGmailDelivery } from './gmail-event-normalizer.util';

/**
 * Gmail, as a source of the inbound-events hub (`next-steps/mail.md` §5). Its
 * deliveries come from our own poll of the accounts a routine watches, not a
 * webhook, so there is nothing to verify: the poll names the workspace the
 * account belongs to, and this says what its mail means in the catalog's words.
 */
@Injectable()
export class GmailEventSource implements ExternalEventSourcePort {
  readonly id = 'gmail' as const;

  accepts(eventName: string): boolean {
    return eventName === GMAIL_DELIVERY_EVENT;
  }

  async resolveTenants(delivery: InboundDelivery): Promise<string[]> {
    const organizationId = delivery.payload.organizationId;
    return typeof organizationId === 'string' && organizationId ? [organizationId] : [];
  }

  normalize(delivery: InboundDelivery): ExternalEvent[] {
    return normalizeGmailDelivery(delivery);
  }
}
