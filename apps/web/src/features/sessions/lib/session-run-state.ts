import type { SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';

type SessionDot = 'running' | 'idle' | 'failed' | 'pending' | 'completed';

/**
 * How a session's **group** reads as a dot. The sidebar shows the group
 * because it is organised by what needs you, not what a process is doing. A
 * session the host has not built yet is `idle` by group, but the artboard
 * draws it with a pulsing grey glyph: that is the **lifecycle**, and {@link
 * dotFor} combines the two. A delete its host has not carried out pulses the
 * same way, and one its host refused is red: both say so in the row's status
 * word, since the row is not what it was.
 */
const DOT: Record<SessionGroup, SessionDot> = {
  working: 'running',
  'waiting-on-you': 'failed',
  'ready-for-review': 'running',
  landing: 'pending',
  idle: 'idle',
  resolved: 'completed',
};

export function dotFor(session: SessionEntity): SessionDot {
  if (session.closeRefusal) return 'failed';
  return session.isProvisioning || session.isClosing ? 'pending' : DOT[session.state];
}

/**
 * The sidebar row's glyph: grey, but for what the row is going through (a
 * session still building or being deleted pulses, a refused delete is red).
 * What the session needs from the reader is the row's dot ({@link attentionFor}),
 * and work in flight is its name's shimmer, so the glyph carries neither.
 */
export function rowGlyphFor(session: SessionEntity): 'idle' | 'pending' | 'failed' {
  if (session.closeRefusal) return 'failed';
  return session.isProvisioning || session.isClosing ? 'pending' : 'idle';
}

/**
 * The sidebar row's dot, as the bots draw theirs: amber while the session
 * waits on the reader, blue once it is ready for review; none otherwise.
 */
export function attentionFor(session: SessionEntity): 'needs-you' | 'done' | undefined {
  if (session.isClosing || session.isProvisioning) return undefined;
  if (session.state === 'waiting-on-you') return 'needs-you';
  if (session.state === 'ready-for-review') return 'done';
  return undefined;
}

/**
 * The row's dot, all told: what the session needs from the reader wins, then
 * the reader's own unread mark.
 */
export function rowAttentionFor(
  session: SessionEntity,
  unread: boolean,
): 'needs-you' | 'done' | 'unread' | undefined {
  return attentionFor(session) ?? (unread ? 'unread' : undefined);
}

/**
 * Whether the agent is at work right now, which the row's name shimmers for:
 * the `working` group of a session that is up, not one the dot merely draws
 * green (`ready-for-review` is green and done).
 */
export function isWorking(session: SessionEntity): boolean {
  return session.state === 'working' && session.isLive && !session.isClosing;
}

/**
 * The word beside the dot in a session's header ("Running", the frame's
 * `paneState`), under `sessions.session.state`. The lifecycle speaks first —
 * a session still starting, one that failed to, one stopped or deleted is
 * that, whatever its group — and a live one reads its group.
 */
export type SessionStateWord =
  | 'starting'
  | 'failed'
  | 'stopped'
  | 'deleted'
  | 'deleting'
  | SessionGroup;

export function stateWordFor(session: SessionEntity): SessionStateWord {
  if (session.isClosing) return 'deleting';
  if (session.isProvisioning) return 'starting';
  if (session.lifecycle === 'failed') return 'failed';
  if (session.isResolved) return 'deleted';
  if (!session.isLive) return 'stopped';
  return session.state;
}

/** Why the agent says it waits, under `sessions.session.agentReport`. */
export type AgentReportWord = 'permission' | 'question' | 'auth' | 'error';

/**
 * What the session's bar adds after its state word when the agent itself
 * said what it is doing (OSC 7501): why it is blocked, or that its turn
 * ended in an error, and its own message. Nothing for a session that is
 * not up, or whose state was read off its screen.
 */
export function agentNoteFor(
  session: SessionEntity,
): { word: AgentReportWord | null; message: string | null } | null {
  const report = session.agentReport;
  if (!report || !session.isLive || session.isClosing) return null;
  const word: AgentReportWord | null =
    report.state === 'error' ? 'error' : report.state === 'blocked' ? report.kind : null;
  if (!word && !report.message) return null;
  return { word, message: report.message };
}
