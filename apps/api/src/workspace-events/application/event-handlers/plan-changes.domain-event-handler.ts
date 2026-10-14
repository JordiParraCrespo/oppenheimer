import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MilestoneChangedDomainEvent } from '../../../tasks/domain/events/milestone-changed.domain-event';
import { TaskChangedDomainEvent } from '../../../tasks/domain/events/task-changed.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A task or a milestone was written, by a person or an agent: tell its
 * workspace's console, which re-reads the board. The event carries its
 * workspace, so a delete is routed after the row is gone.
 */
@Injectable()
export class PlanChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(TaskChangedDomainEvent.name)
  async task(event: Pick<TaskChangedDomainEvent, 'aggregateId' | 'organizationId'>) {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'task.changed', id: event.aggregateId },
    );
  }

  @OnEvent(MilestoneChangedDomainEvent.name)
  async milestone(event: Pick<MilestoneChangedDomainEvent, 'aggregateId' | 'organizationId'>) {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'milestone.changed', id: event.aggregateId },
    );
  }
}
