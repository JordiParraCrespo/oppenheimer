/**
 * The workspace event stream's vocabulary: what `GET /v1/events` sends the
 * console, one Server-Sent Event per change (`product/versions/mvp/21-workspace-events.md`).
 *
 * An event says **that** something changed, never what it now is. The console
 * answers one by re-reading the endpoint it already reads for that thing, so
 * every read keeps its cache key, its authorization and its shape, and a
 * missed event costs one refetch rather than a wrong screen.
 *
 * Each event is scoped to one workspace: the API publishes it on that
 * workspace's channel and only that workspace's streams receive it.
 */
export const WORKSPACE_EVENT_TYPES = [
  /** A session's row changed: created, a start step landed, opened, failed, stopped, restarted, closed. */
  'session.changed',
  /** A host's row changed: it came online or went offline, or was paired, renamed or removed. */
  'host.changed',
  /** A pairing token was spent; `hostId` is the machine it paired. */
  'pairing.spent',
  /** An automation run was queued, started or finished. */
  'automationRun.changed',
] as const;

export type WorkspaceEventType = (typeof WORKSPACE_EVENT_TYPES)[number];

export type WorkspaceEvent =
  | { type: 'session.changed'; id: string }
  | { type: 'host.changed'; id: string }
  | { type: 'pairing.spent'; id: string; hostId: string }
  | { type: 'automationRun.changed'; id: string; automationId: string | null };

/**
 * The SSE `event:` name of the frame the API sends once a stream is
 * subscribed, before any change. The console treats the stream as covering
 * the workspace only from this frame on, so an event published between the
 * request and the subscription is never assumed seen.
 */
export const WORKSPACE_STREAM_READY = 'ready';

/** The SSE `event:` name every {@link WorkspaceEvent} is sent under; its `data` is the JSON. */
export const WORKSPACE_STREAM_EVENT = 'change';

export function isWorkspaceEvent(value: unknown): value is WorkspaceEvent {
  if (typeof value !== 'object' || value === null) return false;
  const { type, id } = value as { type?: unknown; id?: unknown };
  return (
    typeof id === 'string' &&
    typeof type === 'string' &&
    (WORKSPACE_EVENT_TYPES as readonly string[]).includes(type)
  );
}
