import {
  type EventSourceLike,
  ServerEventStream,
  type ServerEventStreamStatus,
} from '@oppenheimer/frontend-core';
import {
  isWorkspaceEvent,
  WORKSPACE_STREAM_EVENT,
  WORKSPACE_STREAM_READY,
  type WorkspaceEvent,
} from '@oppenheimer/shared/workspace-events';

/** `live` from the API's `ready` frame, `down` while redialling, `closed` once refused. */
export type WorkspaceStreamStatus = ServerEventStreamStatus;

export interface WorkspaceEventStreamOptions {
  apiBaseUrl: string;
  /** Injected in tests; `EventSource` with credentials otherwise. */
  sourceFactory?: (url: string) => EventSourceLike;
}

/**
 * The workspace's change feed (`GET /api/v1/events`): one Server-Sent Events
 * connection per console tab, carrying invalidations, never rows. A refused
 * stream stays closed, and the console's polls carry on as they would
 * without it.
 */
export type { EventSourceLike };

export class WorkspaceEventStream extends ServerEventStream<WorkspaceEvent> {
  constructor({ apiBaseUrl, sourceFactory }: WorkspaceEventStreamOptions) {
    super({
      url: `${apiBaseUrl}/api/v1/events`,
      readyEvent: WORKSPACE_STREAM_READY,
      eventName: WORKSPACE_STREAM_EVENT,
      read: (data) => (isWorkspaceEvent(data) ? data : null),
      sourceFactory,
    });
  }
}
