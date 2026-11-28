import { POST_TIMEOUT_MS } from '@/sessions/chat';
import { CLAUDE_POST, type ClaudePostMessage, TAP_SOURCE, type TapMessage } from './tap-message';

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

/**
 * Posts a reply on claude.ai for the worker. A write signed with claude.ai's
 * cookies is taken only from claude.ai's own pages, and this script runs in
 * one, so the worker hands the post here. Only a POST to claude.ai's own API
 * is made; the answer is its status, or `error` when none came.
 */
chrome.runtime.onMessage.addListener((message: unknown, _sender, reply) => {
  const post = message as Partial<ClaudePostMessage> | undefined;
  if (post?.type !== CLAUDE_POST || typeof post.url !== 'string') return false;
  const url = new URL(post.url, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith('/v1/')) {
    reply({ error: 'not claude.ai' });
    return false;
  }
  fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: post.headers ?? {},
    body: JSON.stringify(post.body),
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  })
    .then((response) => reply({ status: response.status }))
    .catch(() => reply({ error: 'no answer' }));
  return true;
});
