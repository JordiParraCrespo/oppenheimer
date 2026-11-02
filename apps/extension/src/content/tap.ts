import { TAP_SOURCE } from './tap-message';

/**
 * Runs inside claude.ai's own page (the MAIN world) and watches its fetches.
 * When claude.ai/code loads its session list, or one session, this passes
 * the answer on — with the URL it came from and the non-secret headers it
 * was asked with — to `bridge.ts`. That is how the extension learns the real
 * endpoint without being told, and keeps up to date for free while a
 * claude.ai tab is open.
 *
 * It reads a clone of the response and changes nothing. It never touches a
 * cookie or the Authorization header.
 */
const KEPT_HEADER = /^(anthropic-|x-organization)/i;
const SESSIONS_URL = /\/sessions(\/[^/?]+)?(\?|$)/;

const original = window.fetch;

window.fetch = async function tappedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await original.call(window, input, init);
  try {
    watch(input, init, response);
  } catch {
    // Watching must never break the page.
  }
  return response;
};

function watch(input: RequestInfo | URL, init: RequestInit | undefined, response: Response) {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(request?.url ?? String(input), location.href);
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || !SESSIONS_URL.test(url.pathname + url.search)) return;
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return;

  const headers = kept(init?.headers ?? request?.headers);
  void response
    .clone()
    .json()
    .then((body: unknown) => {
      window.postMessage({ source: TAP_SOURCE, url: url.href, headers, body }, location.origin);
    })
    .catch(() => {});
}

function kept(headers: HeadersInit | undefined) {
  const out: Record<string, string> = {};
  if (!headers) return out;
  const entries =
    headers instanceof Headers
      ? [...headers.entries()]
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers);
  for (const [name, value] of entries) {
    if (KEPT_HEADER.test(name)) out[name.toLowerCase()] = String(value);
  }
  return out;
}
