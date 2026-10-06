import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUTOMATION_RUN_REPOSITORY } from '../../../automations/automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../../../automations/database/automation-run.repository.port';
import { AutomationRunChangedDomainEvent } from '../../../automations/domain/events/automation-run-changed.domain-event';
import { SessionUpdatedDomainEvent } from '../../../sessions/domain/events/session-updated.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A run moved. Queued, skipped, deferred and dispatched are the run's own
 * writes; running and finished are its session's, so a change to a session an
 * automation started is announced as its run's too. Only such a session is
 * looked up: its event says its origin.
 */
@Injectable()
export class AutomationRunChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  @OnEvent(AutomationRunChangedDomainEvent.name)
  async onRun(
    event: Pick<AutomationRunChangedDomainEvent, 'aggregateId' | 'organizationId' | 'automationId'>,
  ): Promise<void> {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'automationRun.changed', id: event.aggregateId, automationId: event.automationId },
    );
  }

  @OnEvent(SessionUpdatedDomainEvent.name)
  async onSession(event: Pick<SessionUpdatedDomainEvent, 'aggregateId' | 'origin'>): Promise<void> {
    if (event.origin !== 'automation') return;
    const run = await this.runs.findOneBySessionForSystem(event.aggregateId);
    if (run.isNone()) return;
    const { id, organizationId, automationId } = run.unwrap();
    await this.bus.publish({ organizationId }, { type: 'automationRun.changed', id, automationId });
  }
}
