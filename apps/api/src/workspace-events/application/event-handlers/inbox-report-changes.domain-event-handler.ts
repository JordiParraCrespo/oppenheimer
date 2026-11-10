import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InboxReportChangedDomainEvent } from '../../../inbox/domain/events/inbox-report-changed.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A report was sent to a workspace's Inbox, or answered there: tell the
 * workspace's consoles, so an open Inbox shows it, and drops it, without a
 * reload. A report is the workspace's, unlike a mark.
 */
@Injectable()
export class InboxReportChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(InboxReportChangedDomainEvent.name)
  async handle(
    event: Pick<InboxReportChangedDomainEvent, 'organizationId' | 'reportId'>,
  ): Promise<void> {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'inboxReport.changed', id: event.reportId },
    );
  }
}
