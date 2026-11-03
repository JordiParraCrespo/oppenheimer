import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectArchivedDomainEvent } from '../../../projects/domain/events/project-archived.domain-event';
import { ProjectChangedDomainEvent } from '../../../projects/domain/events/project-changed.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A project was made, changed or archived, by a person or a bot acting for
 * one: tell its workspace's console, which re-reads its projects, so the
 * sidebar and the project pickers show what a bot did from chat.
 */
@Injectable()
export class ProjectChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(ProjectChangedDomainEvent.name)
  async changed(event: Pick<ProjectChangedDomainEvent, 'aggregateId' | 'organizationId'>) {
    await this.announce(event);
  }

  @OnEvent(ProjectArchivedDomainEvent.name)
  async archived(event: Pick<ProjectArchivedDomainEvent, 'aggregateId' | 'organizationId'>) {
    await this.announce(event);
  }

  private async announce(event: { aggregateId: string; organizationId: string }) {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'project.changed', id: event.aggregateId },
    );
  }
}
