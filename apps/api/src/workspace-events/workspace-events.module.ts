import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RedisWorkspaceEventsAdapter } from './infrastructure/redis-workspace-events.adapter';
import { StreamWorkspaceEventsHttpController } from './queries/stream-workspace-events/stream-workspace-events.http.controller';
import { StreamWorkspaceEventsQueryHandler } from './queries/stream-workspace-events/stream-workspace-events.query-handler';
import { WORKSPACE_EVENT_FEED, WORKSPACE_EVENTS } from './workspace-events.di-tokens';

/**
 * The console's change feed: modules publish that something changed, once it
 * has committed, and `GET /v1/events` streams it to the console tabs of the
 * workspace (or the person) it concerns. Global, like the outbox: a module
 * that changes something the console shows publishes without importing this.
 *
 * It owns no table and reads none: an event names what changed, and the
 * console re-reads it through the endpoint that already authorises that read.
 */
@Global()
@Module({
  imports: [CqrsModule],
  controllers: [StreamWorkspaceEventsHttpController],
  providers: [
    RedisWorkspaceEventsAdapter,
    { provide: WORKSPACE_EVENTS, useExisting: RedisWorkspaceEventsAdapter },
    { provide: WORKSPACE_EVENT_FEED, useExisting: RedisWorkspaceEventsAdapter },
    StreamWorkspaceEventsQueryHandler,
  ],
  exports: [WORKSPACE_EVENTS],
})
export class WorkspaceEventsModule {}
