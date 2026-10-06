import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionStateChangedDomainEvent } from '../../../sessions/domain/events/session-state-changed.domain-event';
import { SessionTurnChangedDomainEvent } from '../../../sessions/domain/events/session-turn-changed.domain-event';
import type { WorkspaceEventsPort } from '../../../workspace-events/application/workspace-events.port';
import { WORKSPACE_EVENTS } from '../../../workspace-events/workspace-events.di-tokens';
import { AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';

/**
 * A dispatched run's status is its session's: running while the first turn
 * is, finished when it ends or the session fails or closes. Those are the
 * session module's writes, so the run's change is announced here, when they
 * have committed, for the console's run screens to refetch.
 *
 * A turn a person started is never a run's, so only an automation's turn is
 * looked up; a lifecycle change is rare enough to look up always.
 */
@Injectable()
export class RunSessionChangedDomainEventHandler {
  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(WORKSPACE_EVENTS)
    private readonly events: WorkspaceEventsPort,
  ) {}

  @OnEvent(SessionTurnChangedDomainEvent.name)
  async onTurn(
    event: Pick<SessionTurnChangedDomainEvent, 'aggregateId' | 'origin'>,
  ): Promise<void> {
    if (event.origin !== 'automation') return;
    await this.announce(event.aggregateId);
  }

  @OnEvent(SessionStateChangedDomainEvent.name)
  async onState(event: Pick<SessionStateChangedDomainEvent, 'aggregateId'>): Promise<void> {
    await this.announce(event.aggregateId);
  }

  private async announce(sessionId: string): Promise<void> {
    const run = await this.runs.findOneBySessionForSystem(sessionId);
    if (run.isNone()) return;
    const { id, organizationId, automationId } = run.unwrap();
    this.events.publish({ organizationId }, { type: 'automationRun.changed', id, automationId });
  }
}
