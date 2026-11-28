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

/** What the alerts remember of one session between two looks at the list. */
export interface SessionWatch {
  state: SessionEntity['state'];
}

/**
 * One look at the session list: the sessions whose turn just ended (the row's
 * dot went blue), and what to remember for the next look. A first look
 * (`watches` null) tells nothing and only remembers, so opening the console
 * does not announce what was already blue. A session left blue is the
 * Inbox's to remind about, not a notification's.
 */
export function watchSessions(
  watches: ReadonlyMap<string, SessionWatch> | null,
  sessions: readonly SessionEntity[],
): { done: SessionEntity[]; watches: Map<string, SessionWatch> } {
  const done: SessionEntity[] = [];
  const next = new Map<string, SessionWatch>();
  for (const session of sessions) {
    const previous = watches?.get(session.id);
    if (
      watches !== null &&
      previous?.state !== session.state &&
      session.state === 'ready-for-review' &&
      !session.isClosing
    ) {
      done.push(session);
    }
    next.set(session.id, { state: session.state });
  }
  return { done, watches: next };
}
