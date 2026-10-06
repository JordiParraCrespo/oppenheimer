/**
 * A tab opened in the click, for an address that only arrives after an
 * `await`. Popup blockers refuse a `window.open` once the click's task is
 * over, so the tab opens blank first, with `opener` cut, and is pointed at
 * the address when it comes. A blocked popup leaves nowhere to send the reader
 * but this tab.
 *
 * `onReturn` runs the next time this window gets focus back: the reader did
 * something on the other tab (installed an App, granted access) that this one
 * should now read again.
 */
export interface PendingTab {
  go: (url: string) => void;
  close: () => void;
}

export function openPendingTab(options: { onReturn?: () => void } = {}): PendingTab {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  if (options.onReturn) window.addEventListener('focus', options.onReturn, { once: true });

  return {
    go: (url) => {
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    },
    close: () => {
      tab?.close();
      if (options.onReturn) window.removeEventListener('focus', options.onReturn);
    },
  };
}
