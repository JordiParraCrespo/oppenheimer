import type { SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';

type SessionDot = 'running' | 'idle' | 'failed' | 'pending' | 'completed';

/**
 * How a session's **group** reads as a dot. The sidebar shows the group
 * because it is organised by what needs you, not what a process is doing
 * (`product/versions/mvp/05-screens.md`). A session the host has not built yet
 * is `idle` by group, but the artboard draws it with a pulsing grey glyph:
 * that is the **lifecycle**, and {@link dotFor} combines the two. A delete its
 * host has not carried out pulses the same way, and one its host refused is
 * red: both say so in the row's status word, since the row is not what it was.
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
