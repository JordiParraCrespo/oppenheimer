/**
 * The workspace event stream's vocabulary: what `GET /v1/events` sends the
 * console, one Server-Sent Event per change (`product/versions/mvp/03-control-plane.md`).
 *
 * An event says **that** something changed, never what it now is. The console
 * answers one by re-reading the endpoint it already reads for that thing, so
 * every read keeps its cache key, its authorization and its shape, and a
 * missed event costs one refetch rather than a wrong screen.
 *
 * A session's and a run's changes go to the streams of their workspace. A
 * host and its pairing tokens belong to the person who paired them, not to a
 * workspace, so theirs go to that person's streams.
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
  | { type: 'automationRun.changed'; id: string; automationId: string };

/**
 * The SSE `event:` name of the frame the API sends once a stream is
 * subscribed, before any change: from here on, every change is delivered.
 */
export const WORKSPACE_STREAM_READY = 'ready';

/** The SSE `event:` name every {@link WorkspaceEvent} is sent under; its `data` is the JSON. */
export const WORKSPACE_STREAM_EVENT = 'change';

/** Whether a parsed frame is one of {@link WorkspaceEvent}'s variants, with every field it names. */
export function isWorkspaceEvent(value: unknown): value is WorkspaceEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== 'string') return false;
  switch (event.type) {
    case 'session.changed':
    case 'host.changed':
      return true;
    case 'pairing.spent':
      return typeof event.hostId === 'string';
    case 'automationRun.changed':
      return typeof event.automationId === 'string';
    default:
      return false;
  }
}
