import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SessionChangedDomainEventHandler } from './application/event-handlers/session-changed.domain-event-handler';
import { RedisLiveEventsAdapter } from './infrastructure/redis-live-events.adapter';
import { LIVE_EVENTS } from './live.di-tokens';
import { StreamLiveEventsHttpController } from './queries/stream-live-events/stream-live-events.http.controller';
import { StreamLiveEventsQueryHandler } from './queries/stream-live-events/stream-live-events.query-handler';

/**
 * The console's live stream: domain events that change what a console draws,
 * fanned out over Redis to every replica holding a console of that workspace
 * (`product/versions/mvp/03-control-plane.md`, "The live stream, as built").
 */
@Module({
  imports: [CqrsModule],
  controllers: [StreamLiveEventsHttpController],
  providers: [
    StreamLiveEventsQueryHandler,
    SessionChangedDomainEventHandler,
    { provide: LIVE_EVENTS, useClass: RedisLiveEventsAdapter },
  ],
})
export class LiveModule {}
