/**
 * A Claude Code cloud session — one started from claude.ai/code, by
 * `claude --cloud`, or by a scheduled task — and what it is doing.
 *
 * The record is what claude.ai's sessions list returns. It is not a public
 * API: the fields read here are the ones the Claude Code CLI itself reads to
 * draw its cloud session list, and `classify` applies the same rules, so the
 * extension and `claude` agree on what "needs you" means.
 */
export interface CloudSessionRecord {
  id: string;
  title?: string | null;
  /** `active`, `paused`, `archived`, `failed`. */
  status?: string;
  /** `running`, `idle`, `requires_action`, … */
  worker_status?: string;
  /** The server's own summary: `working`, `blocked`, `failed`, `completed`. */
  status_bucket?: string;
  connection_status?: string;
  environment_kind?: string;
  created_at?: string;
  updated_at?: string;
  last_event_at?: string;
  config?: { sources?: Array<{ type?: string; url?: string }> };
  external_metadata?: {
    pending_action?: { tool_name?: string; display_name?: string; type?: string } | null;
    post_turn_summary?: { status_detail?: string } | null;
    last_init_error?: { message?: string } | null;
  };
}

/**
 * - `needs-input` waiting on you: a permission, a question, a plan
 * - `failed`      the last turn or the environment failed
 * - `done`        the turn finished and the session is idle
 * - `running`     working
 * - `stopped`     paused with nothing pending; a reply resumes it
 * - `archived`    gone from the list
 *
 * `needs-input`, `failed` and `running` are the design system's own words for
 * a session's run state (`StatusState`), so a row draws them as-is.
 */
export type SessionState = 'needs-input' | 'failed' | 'done' | 'running' | 'stopped' | 'archived';

/** What the extension keeps of a session, and all the popup draws. */
export interface TrackedSession {
  id: string;
  title: string;
  state: Exclude<SessionState, 'archived'>;
  /** Why it is in that state, when there is more to say: "Wants to use Bash". */
  reason: string | null;
  /** `owner/name` of its GitHub repository, when it has one. */
  repo: string | null;
  /** When it last did anything, ISO 8601. */
  updatedAt: string | null;
}

/** The states that make a session count in the badge. */
export const NEEDS_YOU: ReadonlySet<SessionState> = new Set(['needs-input', 'failed']);

/** The states worth a notification when a session moves into one. */
export const NOTIFIES: ReadonlySet<SessionState> = new Set(['needs-input', 'failed', 'done']);

export function classify(session: CloudSessionRecord): { state: SessionState; reason?: string } {
  if (session.status === 'archived') return { state: 'archived' };
  if (session.status === 'failed') {
    return { state: 'failed', reason: 'The cloud environment could not be provisioned' };
  }

  const initError = session.external_metadata?.last_init_error;
  if (initError && session.environment_kind !== 'bridge' && !isLive(session)) {
    return {
      state: 'failed',
      reason: text(initError.message) || 'The cloud environment failed to start',
    };
  }

  // A pending permission or question. The CLI only calls it blocked once the
  // session has paused, but the pending action is waiting on a person either way.
  if (session.worker_status === 'requires_action') {
    return { state: 'needs-input', reason: pendingReason(session) };
  }

  if (session.worker_status === 'idle' || session.status === 'paused') {
    switch (session.status_bucket) {
      case 'blocked':
        return { state: 'needs-input', reason: pendingReason(session) };
      case 'failed':
        return {
          state: 'failed',
          reason:
            text(session.external_metadata?.post_turn_summary?.status_detail) ||
            'The last turn failed',
        };
      case 'working':
        return { state: 'running' };
      case 'completed':
        return { state: 'done' };
      default:
        return session.worker_status === 'idle'
          ? { state: 'done' }
          : { state: 'stopped', reason: 'Paused · reply to resume' };
    }
  }

  if (session.worker_status === 'running' && session.connection_status === 'disconnected') {
    return { state: 'running', reason: 'Reconnecting' };
  }
  return { state: 'running' };
}

/** The tracked record, or `null` for an archived session (which is no longer tracked). */
export function toTracked(session: CloudSessionRecord): TrackedSession | null {
  const { state, reason } = classify(session);
  if (state === 'archived') return null;
  const repo = session.config?.sources?.find((source) => source.type === 'git_repository')?.url;
  return {
    id: session.id,
    title: text(session.title ?? '').replace(/\s+/g, ' ') || 'Untitled',
    state,
    reason: reason ?? null,
    repo: repo ? repo.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '') : null,
    updatedAt: session.last_event_at ?? session.updated_at ?? session.created_at ?? null,
  };
}

/** Is this a session record, and not some other payload under a `/sessions` URL? */
export function isSessionRecord(value: unknown): value is CloudSessionRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    ('worker_status' in value || 'status_bucket' in value)
  );
}

/** The session records in a list response, or `null` when the body is not a session list. */
export function sessionList(body: unknown): CloudSessionRecord[] | null {
  const array = Array.isArray(body)
    ? body
    : typeof body === 'object' && body !== null
      ? ((body as Record<string, unknown>).data ?? (body as Record<string, unknown>).sessions)
      : undefined;
  if (!Array.isArray(array)) return null;
  // An empty list is still a list; a list of something else is not.
  if (array.length > 0 && !array.some(isSessionRecord)) return null;
  return array.filter(isSessionRecord);
}

function isLive(session: CloudSessionRecord) {
  return ['running', 'idle', 'requires_action'].includes(session.worker_status ?? '');
}

function pendingReason(session: CloudSessionRecord) {
  const pending = session.external_metadata?.pending_action;
  const tool = pending?.display_name ?? pending?.tool_name;
  if (tool) return `Wants to use ${tool}`;
  if (pending?.type === 'plan_approval' || pending?.type === 'exit_plan_mode') {
    return 'Has a plan for you to approve';
  }
  return 'Waiting for your answer';
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}
