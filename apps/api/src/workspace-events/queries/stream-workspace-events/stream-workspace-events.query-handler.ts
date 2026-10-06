import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { Observable } from 'rxjs';
import type {
  WorkspaceEventAudience,
  WorkspaceEventFeedPort,
} from '../../application/workspace-events.port';
import { WORKSPACE_EVENT_FEED } from '../../workspace-events.di-tokens';
import { StreamWorkspaceEventsQuery } from './stream-workspace-events.query';

/**
 * How often an idle stream says it is still there. Under the proxies' read
 * timeouts (nginx's is an hour) and well under a load balancer's minute.
 */
export const STREAM_KEEPALIVE_MS = 25_000;

/**
 * How long one stream lives before the API ends it. The browser redials at
 * once, and the redial is a fresh request: it is authenticated again, so a
 * session that expired or was revoked mid-stream stops receiving within this,
 * and a workspace switch takes effect.
 */
export const STREAM_MAX_LIFETIME_MS = 15 * 60_000;

/** What the stream sends, before the controller spells it as Server-Sent Events. */
export type WorkspaceStreamFrame =
  | { kind: 'ready' }
  | { kind: 'change'; event: WorkspaceEvent }
  | { kind: 'keepalive' };

@QueryHandler(StreamWorkspaceEventsQuery)
export class StreamWorkspaceEventsQueryHandler
  implements IQueryHandler<StreamWorkspaceEventsQuery, Observable<WorkspaceStreamFrame>>
{
  constructor(
    @Inject(WORKSPACE_EVENT_FEED)
    private readonly feed: WorkspaceEventFeedPort,
  ) {}

  async execute(query: StreamWorkspaceEventsQuery): Promise<Observable<WorkspaceStreamFrame>> {
    const audiences: WorkspaceEventAudience[] = [{ userId: query.userId }];
    if (query.organizationId) audiences.push({ organizationId: query.organizationId });

    return new Observable<WorkspaceStreamFrame>((subscriber) => {
      let unsubscribe: (() => void) | null = null;
      let closed = false;
      // `ready` only once the subscription is in place: the console stands its
      // polls down on it, so nothing published before then may count as seen.
      this.feed
        .subscribe(audiences, (event) => subscriber.next({ kind: 'change', event }))
        .then((off) => {
          if (closed) {
            off();
            return;
          }
          unsubscribe = off;
          subscriber.next({ kind: 'ready' });
        })
        .catch((error: unknown) => subscriber.error(error));
      const keepalive = setInterval(
        () => subscriber.next({ kind: 'keepalive' }),
        STREAM_KEEPALIVE_MS,
      );
      const lifetime = setTimeout(() => subscriber.complete(), STREAM_MAX_LIFETIME_MS);
      keepalive.unref();
      lifetime.unref();
      return () => {
        closed = true;
        clearInterval(keepalive);
        clearTimeout(lifetime);
        unsubscribe?.();
      };
    });
  }
}
