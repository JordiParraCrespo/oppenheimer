import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { LiveEvent } from '@oppenheimer/shared/live';
import { Observable, Subject } from 'rxjs';
import type { LiveEventsPort } from '../../application/live-events.port';
import { LiveErrors } from '../../domain/live.errors';
import { LIVE_EVENTS } from '../../live.di-tokens';
import { StreamLiveEventsQuery } from './stream-live-events.query';

/**
 * The workspace's events, from the moment the bus confirmed the subscription
 * until the stream is let go. A bus that cannot be reached refuses the stream
 * (`LIVE_001`) instead of opening one that would never speak, so the console
 * keeps polling.
 */
@QueryHandler(StreamLiveEventsQuery)
export class StreamLiveEventsQueryHandler
  implements IQueryHandler<StreamLiveEventsQuery, Observable<LiveEvent>>
{
  constructor(@Inject(LIVE_EVENTS) private readonly live: LiveEventsPort) {}

  async execute(query: StreamLiveEventsQuery): Promise<Observable<LiveEvent>> {
    const events = new Subject<LiveEvent>();
    let leave: () => void;
    try {
      leave = await this.live.subscribe(query.organizationId, (event) => events.next(event));
    } catch {
      throw new AppError(LiveErrors.UNAVAILABLE);
    }
    return new Observable<LiveEvent>((subscriber) => {
      const subscription = events.subscribe(subscriber);
      return () => {
        subscription.unsubscribe();
        leave();
      };
    });
  }
}
