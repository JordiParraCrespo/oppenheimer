/**
 * Whether the preview pane is open beside a session, kept on this device:
 * a reader who works with the device beside the terminal opens it once, not
 * on every session. The reader's choice, so the API never hears of it.
 */
const PREVIEW_OPEN_KEY = 'oppenheimer.session.preview';

/** Anything unreadable, or storage switched off, is closed. */
export function storedPreviewOpen(): boolean {
  try {
    return window.localStorage.getItem(PREVIEW_OPEN_KEY) === 'open';
  } catch {
    return false;
  }
}

export function rememberPreviewOpen(open: boolean) {
  try {
    window.localStorage.setItem(PREVIEW_OPEN_KEY, open ? 'open' : 'closed');
  } catch {
    // Private browsing or a full quota: the choice holds until the page reloads.
  }
}

/** The preview pane's two views (`SessionsConsole.dc.html`). */
export type PreviewTab = 'browser' | 'simulator';

/** Which view the pane opens on, kept on this device like whether it is open. */
const PREVIEW_TAB_KEY = 'oppenheimer.session.preview.tab';

/** The view last chosen, when it is one this console offers; else the first it does. */
export function storedPreviewTab(offered: readonly PreviewTab[]): PreviewTab | undefined {
  try {
    const stored = window.localStorage.getItem(PREVIEW_TAB_KEY);
    const tab = offered.find((one) => one === stored);
    if (tab) return tab;
  } catch {
    // Storage switched off: the first view offered.
  }
  return offered[0];
}

export function rememberPreviewTab(tab: PreviewTab) {
  try {
    window.localStorage.setItem(PREVIEW_TAB_KEY, tab);
  } catch {
    // Private browsing or a full quota: the choice holds until the page reloads.
  }
}
