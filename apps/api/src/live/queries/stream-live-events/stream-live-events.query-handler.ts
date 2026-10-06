import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { LiveEvent } from '@oppenheimer/shared/live';
import { Observable, type Subscriber } from 'rxjs';
import type { LiveEventsPort } from '../../application/live-events.port';
import { LiveErrors } from '../../domain/live.errors';
import { LIVE_EVENTS } from '../../live.di-tokens';
import { StreamLiveEventsQuery } from './stream-live-events.query';

/**
 * How long a subscription waits for the response to take it. Nest subscribes
 * as soon as the handler returns, even for a client that has already gone; a
 * response that never does would otherwise hold the channel until shutdown.
 */
const UNCLAIMED_MS = 10_000;

/**
 * The workspace's events as one Observable that owns the subscription: the
 * stream ends when the console lets go, and when the bus drops the channel —
 * the console then dials again, and polls until a dial is answered.
 *
 * The subscription is made before the Observable is returned, so a bus that
 * cannot be reached refuses the stream (`LIVE_001`) before it opens.
 */
@QueryHandler(StreamLiveEventsQuery)
export class StreamLiveEventsQueryHandler
  implements IQueryHandler<StreamLiveEventsQuery, Observable<LiveEvent>>
{
  constructor(@Inject(LIVE_EVENTS) private readonly live: LiveEventsPort) {}

  async execute(query: StreamLiveEventsQuery): Promise<Observable<LiveEvent>> {
    let sink: Subscriber<LiveEvent> | null = null;
    let ended = false;
    let leave: () => void;
    try {
      leave = await this.live.subscribe(query.organizationId, {
        event: (event) => sink?.next(event),
        lost: () => {
          ended = true;
          sink?.complete();
        },
      });
    } catch {
      throw new AppError(LiveErrors.UNAVAILABLE);
    }
    if (ended) {
      leave();
      throw new AppError(LiveErrors.UNAVAILABLE);
    }

    const unclaimed = setTimeout(() => {
      ended = true;
      leave();
    }, UNCLAIMED_MS);
    return new Observable<LiveEvent>((subscriber) => {
      clearTimeout(unclaimed);
      if (ended) {
        subscriber.complete();
        return;
      }
      sink = subscriber;
      return () => {
        sink = null;
        leave();
      };
    });
  }
}
