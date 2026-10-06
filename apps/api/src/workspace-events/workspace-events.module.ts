import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AutomationsModule } from '../automations/automations.module';
import { AutomationRunChangesDomainEventHandler } from './application/event-handlers/automation-run-changes.domain-event-handler';
import { HostChangesDomainEventHandler } from './application/event-handlers/host-changes.domain-event-handler';
import { SessionChangesDomainEventHandler } from './application/event-handlers/session-changes.domain-event-handler';
import { RedisWorkspaceEventsAdapter } from './infrastructure/redis-workspace-events.adapter';
import { StreamWorkspaceEventsHttpController } from './queries/stream-workspace-events/stream-workspace-events.http.controller';
import { StreamWorkspaceEventsQueryHandler } from './queries/stream-workspace-events/stream-workspace-events.query-handler';
import { WORKSPACE_EVENT_BUS } from './workspace-events.di-tokens';

/**
 * The console's change feed. The modules that own sessions, runs and hosts
 * raise domain events as they always do; this module's handlers, run by the
 * outbox after the commit, publish them to the workspace's (or the person's)
 * channel, and `GET /v1/events` streams them to the console tabs listening.
 *
 * It owns no table: an event names what changed, and the console re-reads it
 * through the endpoint that already authorises that read.
 */
@Module({
  imports: [CqrsModule, AutomationsModule],
  controllers: [StreamWorkspaceEventsHttpController],
  providers: [
    { provide: WORKSPACE_EVENT_BUS, useClass: RedisWorkspaceEventsAdapter },
    StreamWorkspaceEventsQueryHandler,
    SessionChangesDomainEventHandler,
    AutomationRunChangesDomainEventHandler,
    HostChangesDomainEventHandler,
  ],
})
export class WorkspaceEventsModule {}
