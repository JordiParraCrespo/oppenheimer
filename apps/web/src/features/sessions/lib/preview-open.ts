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
