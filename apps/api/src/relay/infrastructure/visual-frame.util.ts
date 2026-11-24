import type { IncomingMessage, ServerResponse } from 'node:http';
import { visualFrameOrigin } from '@oppenheimer/shared';

/**
 * The page a visual's HTML runs in: one static shell on the deployment's
 * visuals origin (`visuals.<preview domain>`), the same for every visual.
 * The console frames it with `sandbox="allow-scripts"` (an opaque origin, no
 * storage, no top navigation) and posts it the agent's fragment and the
 * theme's tokens; the shell draws the fragment and reports its height. Its
 * CSP closes the network: no fetch, no image or font from anywhere but
 * `data:` and `blob:`, no form posted, no frame inside, and only the console
 * may frame it. What the page may ask of the console is three messages:
 * its size, an error, and a link to open, which the console asks about.
 *
 * What stays open: a fragment's script that navigates its frame, or inserts
 * a frame as markup (`innerHTML`, `document.write`), is refused and the visual
 * ended, but the browser starts the connection first, looking the host up in
 * DNS, so a host name can carry a few bytes out and that name's DNS sees the
 * viewer's address. Frames, objects, refreshes and prefetch hints written in
 * the fragment's markup are stripped before it runs, and a frame made with
 * `createElement` is refused, so those open nothing. An agent that writes such a page can already reach the
 * network (a bot through `web_fetch`, a session's agent from its host), so
 * this adds no reach it lacks; `visual_html` turns HTML off where it matters.
 */

/** Whether a request's `Host` is the visuals origin of this preview domain. */
export function isVisualFrameHost(previewBase: string, hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  return new URL(visualFrameOrigin(previewBase)).host === hostHeader.toLowerCase();
}

/** The shell's CSP: inline script and style for the fragment, the network closed, framed by the console alone. */
export function visualFrameCsp(consoleOrigin: string): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data:',
    'media-src data: blob:',
    "connect-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${consoleOrigin}`,
  ].join('; ');
}

/** Answers a request for the shell: the page on GET, nothing else. */
export function serveVisualFrame(
  req: IncomingMessage,
  res: ServerResponse,
  consoleOrigin: string,
): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' });
    res.end();
    return;
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': visualFrameCsp(consoleOrigin),
    'cache-control': 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-opener-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  });
  res.end(req.method === 'HEAD' ? undefined : VISUAL_FRAME_SHELL);
}

/** The base stylesheet a fragment is drawn under: the console's type and colours, from the theme's variables. */
const FRAGMENT_STYLE = `
:root { color-scheme: light dark; }
html, body { margin: 0; padding: 0; background: transparent; }
body { font: 13.5px/1.55 var(--font-sans, system-ui, sans-serif); color: var(--fg, #111); overflow-x: hidden; }
* { box-sizing: border-box; }
a { color: var(--link, var(--primary, #2563eb)); }
button, input, select, textarea { font: inherit; color: inherit; }
.card { background: var(--card, transparent); border: 1px solid var(--border, #e5e5e5); border-radius: 14px; padding: 14px 16px; }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border, #e5e5e5); background: var(--card, #fff); cursor: pointer; }
.btn:hover { background: var(--hover, rgba(0,0,0,.05)); }
.btn-primary { background: var(--fg, #111); color: var(--background, #fff); border-color: transparent; }
.muted { color: var(--fg-muted, #666); }
.mono, code { font-family: var(--font-mono, ui-monospace, monospace); font-size: .92em; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 6px 10px; border-top: 1px solid var(--border, #e5e5e5); text-align: left; }
th { color: var(--fg-muted, #666); font-weight: 500; font-size: 12px; }
input[type=range] { accent-color: var(--chart-1, #2563eb); width: 100%; }
`;

/**
 * What runs in the fragment's frame before the fragment: it takes the theme
 * from the shell, reports the page's height, its errors and the links clicked
 * in it to the shell, and takes away WebRTC, the one way out the CSP does not
 * close (best effort: a fragment that works around it still reaches no
 * cookie or page of the console's).
 */
const FRAGMENT_PRELUDE = `(() => {
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCIceCandidate', 'RTCSessionDescription']) {
    try { Object.defineProperty(window, name, { value: undefined, configurable: false, writable: false }); } catch {}
  }
  const post = (message) => parent.postMessage(message, '*');
  const apply = (variables, dark) => {
    for (const [name, value] of Object.entries(variables || {})) {
      if (/^--[a-z0-9-]+$/i.test(name) && typeof value === 'string') document.documentElement.style.setProperty(name, value);
    }
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };
  addEventListener('message', (event) => {
    if (event.source === parent && event.data && event.data.type === 'theme') apply(event.data.variables, event.data.dark);
  });
  addEventListener('error', (event) => post({ type: 'error', message: String(event.message || 'error').slice(0, 300) }));
  addEventListener('unhandledrejection', (event) => post({ type: 'error', message: String(event.reason).slice(0, 300) }));
  addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    event.preventDefault();
    if (/^https?:/i.test(link.href)) post({ type: 'open-link', href: link.href.slice(0, 2048) });
  }, true);
  // A frame is a way to the network a CSP cannot close (the browser looks its host up before
  // refusing it), so the fragment may not make one: refused from script, and the page ends if one appears.
  const FRAMES = /^(iframe|frame|frameset|object|embed|portal)$/i;
  for (const name of ['createElement', 'createElementNS']) {
    const make = Document.prototype[name];
    Document.prototype[name] = function (...args) {
      const tag = String(name === 'createElement' ? args[0] : args[1]);
      if (FRAMES.test(tag.split(':').pop())) throw new DOMException('frames are not allowed in a visual', 'NotSupportedError');
      return make.apply(this, args);
    };
  }
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1 && (FRAMES.test(node.nodeName) || node.querySelector?.('iframe,frame,frameset,object,embed,portal'))) {
        node.remove();
        post({ type: 'escaped' });
        return;
      }
    }
  }).observe(document, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', () => {
    const size = () => post({ type: 'size', height: Math.ceil(document.documentElement.scrollHeight) });
    new ResizeObserver(size).observe(document.documentElement);
    size();
  });
})();`;

/**
 * The shell. The fragment never runs in it: on a `render` message it builds a
 * second frame, `srcdoc` and `sandbox="allow-scripts"`, holding the base
 * stylesheet, the theme, the prelude and the fragment. That frame inherits
 * this page's CSP, so its network is closed, and its own navigations fall
 * under this page's `frame-src 'none'`, so it cannot take itself to another
 * site; a second load of it (a navigation that was refused) ends it and tells
 * the console. The shell passes on the theme, and passes back only height,
 * errors and links, from that frame alone.
 */
export const VISUAL_FRAME_SHELL = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; } iframe { display: block; width: 100%; border: 0; background: transparent; }</style>
</head><body><script>
(() => {
  const STYLE = ${JSON.stringify(FRAGMENT_STYLE)};
  const PRELUDE = ${JSON.stringify(FRAGMENT_PRELUDE).replace(/<\//g, '<\\/')};
  const post = (message) => parent.postMessage(message, '*');
  const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let inner = null;
  let loads = 0;
  const end = (message) => {
    if (inner) inner.remove();
    inner = null;
    post({ type: 'navigated', message });
  };
  addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (inner && event.source === inner.contentWindow) {
      if (data.type === 'size' && typeof data.height === 'number' && isFinite(data.height)) {
        const height = Math.max(0, Math.min(4000, Math.ceil(data.height)));
        inner.style.height = height + 'px';
        post({ type: 'size', height });
      } else if (data.type === 'error') post({ type: 'error', message: String(data.message || '').slice(0, 300) });
      else if (data.type === 'escaped') end('the visual tried to open a frame');
      else if (data.type === 'open-link' && typeof data.href === 'string' && /^https?:\\/\\//i.test(data.href)) post({ type: 'open-link', href: data.href.slice(0, 2048) });
      return;
    }
    if (event.source !== parent) return;
    const vars = Object.entries(data.variables || {})
      .filter(([name, value]) => /^--[a-z0-9-]+$/i.test(name) && typeof value === 'string' && !/[;{}<]/.test(value))
      .map(([name, value]) => name + ':' + value + ';').join('');
    if (data.type === 'theme' && inner) { inner.contentWindow.postMessage({ type: 'theme', variables: data.variables, dark: data.dark }, '*'); return; }
    if (data.type !== 'render' || inner || typeof data.html !== 'string') return;
    const scheme = data.dark ? 'dark' : 'light';
    inner = document.createElement('iframe');
    inner.setAttribute('sandbox', 'allow-scripts');
    inner.setAttribute('title', 'visual');
    inner.addEventListener('load', () => { loads += 1; if (loads > 1) end('the visual tried to leave its frame'); });
    // Parsed inert first: frames, refreshes and a <base> never reach the page, so none can start a lookup.
    const parsed = new DOMParser().parseFromString('<!doctype html><body>' + data.html, 'text/html');
    for (const node of parsed.querySelectorAll('iframe,frame,frameset,object,embed,portal,base,meta[http-equiv],link[rel~="dns-prefetch"],link[rel~="preconnect"]')) node.remove();
    const fragment = parsed.head.innerHTML + parsed.body.innerHTML;
    inner.srcdoc = '<!doctype html><html data-theme="' + scheme + '" style="color-scheme:' + scheme + ';' + escape(vars) + '"><head><meta charset="utf-8"><style>' + STYLE + '</style><script>' + PRELUDE + '<\\/script></head><body>' + fragment + '</body></html>';
    document.body.appendChild(inner);
  });
  post({ type: 'ready' });
})();
</script></body></html>
`;
