import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import type { InboxCopy } from './inbox-copy';

/** What the Inbox's notify switch shows: on, off, refused by the browser, or not offered at all. */
export type AlertSwitch = 'on' | 'off' | 'blocked' | 'unsupported';

/**
 * Whether a new wait is told with a system notification: only when the reader
 * turned it on here, the browser granted it, and this tab is not the one they
 * are looking at (the Inbox and the sidebar already show it there).
 */
export function shouldAlert(
  on: boolean,
  permission: NotificationPermission | undefined,
  page: Pick<Document, 'visibilityState' | 'hasFocus'>,
): boolean {
  if (!on || permission !== 'granted') return false;
  return page.visibilityState !== 'visible' || !page.hasFocus();
}

/** A notification's two lines, from the Inbox row's words: its subject, then what it asks. */
export function alertText(copy: InboxCopy): { title: string; body: string } {
  return { title: copy.short, body: copy.title !== copy.short ? copy.title : copy.body };
}

/** How long a session waits on the reader, amber or blue, before it is told again. */
export const STALE_AFTER_MS = 30 * 60_000;

/** What the alerts remember of one session between two looks at the list. */
export interface SessionWatch {
  state: SessionEntity['state'];
  /** When it entered `state`: the host's word for it, or when this tab first saw it there. */
  since: number;
  /** The host's `observedSince` at that look, so a stale one carried over is told from a fresh one. */
  observed: number | undefined;
  /** Whether this stay in `state` was already told as stale. */
  staleTold: boolean;
}

/**
 * A session needs the reader: amber (it waits on them) or blue (its turn
 * ended). A launch stuck in `starting` is amber too, and the Inbox lists it,
 * so provisioning does not keep it out.
 */
function needsReader(session: SessionEntity): boolean {
  if (session.isClosing) return false;
  return session.state === 'waiting-on-you' || session.state === 'ready-for-review';
}

/**
 * One look at the session list: the sessions whose turn just ended (the row's
 * dot went blue), the sessions that have needed the reader for
 * {@link STALE_AFTER_MS} without being opened, each told once per stay, and
 * what to remember for the next look. A first look (`watches` null) tells
 * nothing and only remembers, so opening the console does not announce what
 * was already blue or long waiting.
 */
export function watchSessions(
  watches: ReadonlyMap<string, SessionWatch> | null,
  sessions: readonly SessionEntity[],
  now: number,
): { done: SessionEntity[]; stale: SessionEntity[]; watches: Map<string, SessionWatch> } {
  const done: SessionEntity[] = [];
  const stale: SessionEntity[] = [];
  const next = new Map<string, SessionWatch>();
  for (const session of sessions) {
    const previous = watches?.get(session.id);
    const observed = session.observedSince?.getTime();
    const same = previous?.state === session.state;
    // The host's time is trusted only when it moved since the last look: a
    // session that fails keeps the agent's old `observedSince` while its
    // group turns amber, and counting from it would call a wait a minute old
    // thirty. Otherwise the clock starts when this tab saw the move, which
    // fails late rather than early.
    const fresh =
      observed !== undefined &&
      (watches === null || (previous !== undefined && observed !== previous.observed));
    const since = fresh ? observed : same ? previous.since : now;
    const overdue = needsReader(session) && now - since >= STALE_AFTER_MS;
    let staleTold = same ? previous.staleTold : false;
    if (watches === null) {
      staleTold = overdue;
    } else {
      if (!same && session.state === 'ready-for-review' && needsReader(session)) {
        done.push(session);
      }
      if (overdue && !staleTold) {
        stale.push(session);
        staleTold = true;
      }
    }
    next.set(session.id, { state: session.state, since, observed, staleTold });
  }
  return { done, stale, watches: next };
}
