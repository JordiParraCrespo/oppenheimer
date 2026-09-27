import { Inject, Injectable } from '@nestjs/common';
import type { Option } from 'oxide.ts';
import type { InboundEventRepositoryPort } from '../database/inbound-event.repository.port';
import type { StoredExternalEvent } from '../domain/external-event.types';
import { INBOUND_EVENT_REPOSITORY } from '../inbound-events.di-tokens';
import type { InboundEventLookupPort, RecentEventsQuery } from './inbound-event-lookup.port';

/** The hub's published read surface, over its own store. */
@Injectable()
export class InboundEventLookupResolver implements InboundEventLookupPort {
  constructor(
    @Inject(INBOUND_EVENT_REPOSITORY)
    private readonly store: InboundEventRepositoryPort,
  ) {}

  findOne(organizationId: string, id: string): Promise<Option<StoredExternalEvent>> {
    return this.store.findOne(organizationId, id);
  }

  findRecent(query: RecentEventsQuery): Promise<StoredExternalEvent[]> {
    return this.store.findRecent(query);
  }
}
