import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { externalEventDefinition } from '@oppenheimer/shared/automations';
import type { InboundEventLookupPort } from '../../../inbound-events/application/inbound-event-lookup.port';
import { INBOUND_EVENT_LOOKUP } from '../../../inbound-events/inbound-events.di-tokens';
import type { TriggerPreview } from '../../domain/automation-read.types';
import { AutomationErrors } from '../../domain/automations.errors';
import { PreviewTriggerQuery } from './preview-trigger.query';

/** The events the card lists under its count. */
const PREVIEW_SAMPLE = 2;

/**
 * "Listening on xrp-mobile · would have run 4 times in the last 7 days": the
 * card replayed against what the webhook actually received, with the same
 * filter the matcher applies, before it is saved. The hub counts in the
 * database, so a busy repository's week is counted exactly, and returns only
 * the two events the card lists.
 */
@QueryHandler(PreviewTriggerQuery)
export class PreviewTriggerQueryHandler
  implements IQueryHandler<PreviewTriggerQuery, TriggerPreview>
{
  constructor(
    @Inject(INBOUND_EVENT_LOOKUP)
    private readonly events: InboundEventLookupPort,
  ) {}

  async execute(query: PreviewTriggerQuery): Promise<TriggerPreview> {
    const { scope, input } = query;
    if (!scope.organizationId) throw new AppError(AutomationErrors.NO_ACTIVE_ORGANIZATION);
    const definition = externalEventDefinition(input.source, input.event);
    if (!definition) return { count: 0, days: input.days, matches: [] };
    const found = await this.events.findMatching({
      organizationId: scope.organizationId,
      source: input.source,
      eventType: input.event,
      subjectRefs: input.repositories.map(String),
      since: new Date(Date.now() - input.days * 86_400_000),
      attribute:
        definition.filterField && input.filter.op === 'equals'
          ? { field: definition.filterField, value: input.filter.value }
          : undefined,
      sampleSize: PREVIEW_SAMPLE,
    });
    return { count: found.count, days: input.days, matches: found.sample };
  }
}
