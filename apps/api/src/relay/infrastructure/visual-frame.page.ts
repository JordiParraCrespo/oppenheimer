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
export function serveVisualFrame(req: IncomingMessage, res: ServerResponse, consoleOrigin: string): void {
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

/**
 * The shell. It takes one `render` message from its parent (the fragment,
 * the theme's variables, light or dark), and a `theme` message whenever the
 * console's theme changes; scripts in the fragment run once it is in place,
 * in order. A base stylesheet sets type, colour and a few classes on the
 * theme's variables, so a fragment looks like the console without styling
 * itself.
 */
export const VISUAL_FRAME_SHELL = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { color-scheme: light dark; }
html, body { margin: 0; padding: 0; background: transparent; }
body { font: 13.5px/1.55 var(--font-sans, system-ui, sans-serif); color: var(--fg, #111); overflow-x: hidden; }
* { box-sizing: border-box; }
a { color: var(--primary, #2563eb); }
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
</style></head>
<body><div id="root"></div><script>
(() => {
  const root = document.getElementById('root');
  const post = (message) => parent.postMessage(message, '*');
  const apply = (variables, dark) => {
    for (const [name, value] of Object.entries(variables || {})) {
      if (/^--[a-z0-9-]+$/i.test(name) && typeof value === 'string') document.documentElement.style.setProperty(name, value);
    }
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };
  let rendered = false;
  addEventListener('error', (event) => post({ type: 'error', message: String(event.message || 'error').slice(0, 300) }));
  addEventListener('unhandledrejection', (event) => post({ type: 'error', message: String(event.reason).slice(0, 300) }));
  addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    event.preventDefault();
    const href = link.href;
    if (/^https?:/i.test(href)) post({ type: 'open-link', href: href.slice(0, 2048) });
  });
  addEventListener('message', (event) => {
    if (event.source !== parent || !event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.type === 'theme') { apply(data.variables, data.dark); return; }
    if (data.type !== 'render' || rendered || typeof data.html !== 'string') return;
    rendered = true;
    apply(data.variables, data.dark);
    root.innerHTML = data.html;
    for (const inert of Array.from(root.querySelectorAll('script'))) {
      const live = document.createElement('script');
      for (const attr of Array.from(inert.attributes)) if (attr.name !== 'src') live.setAttribute(attr.name, attr.value);
      live.textContent = inert.textContent;
      inert.replaceWith(live);
    }
    const size = () => post({ type: 'size', height: Math.ceil(document.documentElement.scrollHeight) });
    new ResizeObserver(size).observe(document.body);
    size();
  });
  post({ type: 'ready' });
})();
</script></body></html>
`;
