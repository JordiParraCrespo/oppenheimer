import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { externalEventDefinition, matchesTriggerFilter } from '@oppenheimer/shared/automations';
import type { InboundEventLookupPort } from '../../../inbound-events/application/inbound-event-lookup.port';
import { INBOUND_EVENT_LOOKUP } from '../../../inbound-events/inbound-events.di-tokens';
import type { TriggerPreview } from '../../domain/automation-read.types';
import { AutomationErrors } from '../../domain/automations.errors';
import { PreviewTriggerQuery } from './preview-trigger.query';

/** A ceiling on what one preview reads: a busy repository's week of pushes. */
const PREVIEW_READ_LIMIT = 1_000;

/**
 * "Listening on xrp-mobile · would have run 4 times in the last 7 days": the
 * card replayed against what the webhook actually received, with the same
 * filter the matcher applies (`matchesTriggerFilter`, shared), before it is
 * saved.
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
    const recent = await this.events.findRecent({
      organizationId: scope.organizationId,
      source: input.source,
      eventType: input.event,
      subjectRefs: input.repositories.map(String),
      since: new Date(Date.now() - input.days * 86_400_000),
      limit: PREVIEW_READ_LIMIT,
    });
    const matching = recent.filter(
      (event) =>
        !event.actor.isOwnApp && matchesTriggerFilter(definition, input.filter, event.attributes),
    );
    return { count: matching.length, days: input.days, matches: matching.slice(0, 2) };
  }
}
