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
