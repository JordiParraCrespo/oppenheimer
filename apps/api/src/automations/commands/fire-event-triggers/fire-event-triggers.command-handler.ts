import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { externalEventDefinition, matchesTriggerFilter } from '@oppenheimer/shared/automations';
import type { InboundEventLookupPort } from '../../../inbound-events/application/inbound-event-lookup.port';
import { INBOUND_EVENT_LOOKUP } from '../../../inbound-events/inbound-events.di-tokens';
import { AutomationLimitsResolver } from '../../application/automation-limits.resolver';
import { AutomationRunMapper } from '../../automation-run.mapper';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import { AutomationRunEntity } from '../../domain/automation-run.entity';
import { firstRefusal, loopGuard, rateGuard } from '../../domain/fire-guard.policy';
import { eventCauseSummary } from '../../domain/run-launch.policy';
import { FireEventTriggersCommand } from './fire-event-triggers.command';

const HOUR = 60 * 60 * 1000;

/**
 * Match an event to the triggers watching its subject, apply each trigger's
 * filter, and queue one run per automation it fires — keyed by the event, so a
 * redelivery queues nothing twice. Paused automations ignore it. An event our
 * own App caused (the loop guard) and one past the hourly caps become a
 * recorded skip with its reason, never a silent drop.
 */
@CommandHandler(FireEventTriggersCommand)
export class FireEventTriggersCommandHandler
  implements ICommandHandler<FireEventTriggersCommand, number>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(INBOUND_EVENT_LOOKUP)
    private readonly events: InboundEventLookupPort,
    private readonly limits: AutomationLimitsResolver,
    private readonly mapper: AutomationRunMapper,
  ) {}

  async execute(command: FireEventTriggersCommand): Promise<number> {
    const definition = externalEventDefinition(command.source, command.eventType);
    if (!definition) return 0;
    const candidates = await this.automations.findEventCandidates(
      command.organizationId,
      command.source,
      command.eventType,
      command.subjectRef,
    );
    const matching = candidates.filter(
      ({ automation, trigger }) =>
        !automation.isPaused &&
        trigger.source !== 'schedule' &&
        matchesTriggerFilter(definition, trigger.config.filter, command.attributes),
    );
    if (matching.length === 0) return 0;

    const found = await this.events.findOne(command.organizationId, command.inboundEventId);
    if (found.isNone()) return 0;
    const causeSummary = eventCauseSummary(this.mapper.eventViewOf(found.unwrap()));
    const now = new Date();
    const since = new Date(now.getTime() - HOUR);
    // Every candidate is of this workspace: its overrides are read once.
    const workspace = await this.limits.workspace(command.organizationId);
    let queued = 0;
    // One run per automation, even when two of its triggers match the same event.
    const seen = new Set<string>();
    for (const { automation, trigger } of matching) {
      if (seen.has(automation.id)) continue;
      seen.add(automation.id);
      const limits = this.limits.resolveWith(workspace, automation);
      const props = {
        organizationId: automation.organizationId,
        automationId: automation.id,
        revisionId: automation.revision.id,
        triggerId: trigger.id,
        cause: 'event' as const,
        causeKey: `event:${command.source}:${command.externalId}`,
        causeSummary,
        inboundEventId: command.inboundEventId,
        scheduledFor: null,
        requestedByUserId: null,
      };
      // Counted and inserted under the workspace's firing lock, so concurrent
      // events — and a tick — cannot all take the last slot.
      const { run, inserted } = await this.runs.fireUnderCaps(
        automation.organizationId,
        automation.id,
        since,
        (recent) => {
          const verdict = firstRefusal(
            () => loopGuard(command.actorIsOwnApp),
            () => rateGuard(limits, recent, false),
          );
          return verdict.kind === 'skip'
            ? AutomationRunEntity.skipped(props, verdict.reason, now)
            : AutomationRunEntity.fire(props, now);
        },
      );
      if (inserted && run.isPending) queued += 1;
    }
    return queued;
  }
}
