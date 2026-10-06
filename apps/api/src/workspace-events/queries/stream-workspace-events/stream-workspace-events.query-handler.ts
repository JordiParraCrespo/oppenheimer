import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { Observable } from 'rxjs';
import type {
  WorkspaceEventAudience,
  WorkspaceEventBusPort,
} from '../../application/workspace-event-bus.port';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import { StreamWorkspaceEventsQuery } from './stream-workspace-events.query';

/**
 * How often an idle stream says it is still there: under the proxies' read
 * timeouts (nginx's is an hour) and well under a load balancer's minute.
 */
export const STREAM_KEEPALIVE_MS = 25_000;

/**
 * How long one stream lives before the API ends it. The browser redials at
 * once, and the redial is a request like any other, so it is authenticated
 * again: a session that expired or was revoked stops receiving. It is not how
 * a missed change is recovered; the console's own reads are.
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
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  async execute(query: StreamWorkspaceEventsQuery): Promise<Observable<WorkspaceStreamFrame>> {
    const audiences: WorkspaceEventAudience[] = [{ userId: query.userId }];
    if (query.organizationId) audiences.push({ organizationId: query.organizationId });

    return new Observable<WorkspaceStreamFrame>((subscriber) => {
      let closed = false;
      let teardown = () => {};
      this.bus
        .subscribe(audiences, (event) => {
          if (query.types.has(event.type)) subscriber.next({ kind: 'change', event });
        })
        .then((unsubscribe) => {
          if (closed) {
            unsubscribe();
            return;
          }
          // `ready` and the stream's clocks start once the subscription is in
          // place: nothing published before it may count as seen.
          const keepalive = setInterval(
            () => subscriber.next({ kind: 'keepalive' }),
            STREAM_KEEPALIVE_MS,
          );
          const lifetime = setTimeout(() => subscriber.complete(), STREAM_MAX_LIFETIME_MS);
          keepalive.unref();
          lifetime.unref();
          teardown = () => {
            clearInterval(keepalive);
            clearTimeout(lifetime);
            unsubscribe();
          };
          subscriber.next({ kind: 'ready' });
        })
        .catch((error: unknown) => subscriber.error(error));
      return () => {
        closed = true;
        teardown();
      };
    });
  }
}
