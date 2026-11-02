import { TAP_SOURCE, type TapMessage } from './tap-message';

/**
 * The extension's half of the tap. The page cannot reach `chrome.runtime`, so
 * `tap.ts` posts here and this passes it to the service worker.
 */
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data as { source?: string } & Omit<TapMessage, 'type'>;
  if (data?.source !== TAP_SOURCE) return;
  const message: TapMessage = {
    type: 'tap',
    url: data.url,
    headers: data.headers,
    body: data.body,
  };
  chrome.runtime.sendMessage(message).catch(() => {
    // The worker was restarting; claude.ai fetches the list again soon enough.
  });
});
