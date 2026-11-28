// Can the browser console show HTML an agent wrote, without trusting it?
// Three local origins stand in for the console (with the CSP of
// apps/web/nginx.conf), a static "visual shell" on its own origin, and
// somewhere an agent's HTML must not reach. Run: node frame-isolation.mjs (CHROMIUM_PATH names a browser when Playwright has none)
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const listen = (handler) =>
  new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
const originOf = (server) => `http://127.0.0.1:${server.address().port}`;

const outsideHits = [];
const outside = await listen((req, res) => {
  outsideHits.push(req.url);
  res.setHeader('access-control-allow-origin', '*');
  res.end('reached');
});

const SHELL = `<!doctype html><meta charset="utf-8"><body><script>
addEventListener('message', (event) => {
  if (event.source !== parent || event.data?.type !== 'render') return;
  for (const [name, value] of Object.entries(event.data.variables)) {
    document.documentElement.style.setProperty(name, value);
  }
  document.body.innerHTML = event.data.html;
  for (const inert of document.body.querySelectorAll('script')) {
    const live = document.createElement('script');
    live.textContent = inert.textContent;
    inert.replaceWith(live);
  }
  new ResizeObserver(() => {
    parent.postMessage({ type: 'size', height: document.body.scrollHeight }, '*');
  }).observe(document.body);
});
parent.postMessage({ type: 'ready' }, '*');
</script>`;

let consoleOrigin = '';
const shell = await listen((_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.setHeader(
    'content-security-policy',
    [
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      'img-src data: blob:',
      "connect-src 'none'",
      "frame-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      `frame-ancestors ${consoleOrigin}`,
    ].join('; '),
  );
  res.end(SHELL);
});

const consoleServer = await listen((_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.setHeader(
    'content-security-policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' ${originOf(shell)}; form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`,
  );
  res.end('<!doctype html><title>console</title><body>');
});
consoleOrigin = originOf(consoleServer);

const report = (name) =>
  `<script>parent.postMessage({ type: 'probe', name: '${name}' }, '*')</script>`;
const attempt = (name, body) =>
  `<script>(async () => { let outcome; try { outcome = await (async () => { ${body} })(); } catch (error) { outcome = 'refused: ' + error.name; } parent.postMessage({ type: 'probe', name: '${name}', outcome }, '*'); })()</script>`;

const fragment = [
  '<div style="height:180px;background:var(--chart-1)">chart</div>',
  report('script-ran'),
  attempt('fetch-outside', `await fetch('${originOf(outside)}/fetch'); return 'reached';`),
  attempt('read-parent', "return 'read ' + parent.document.title;"),
  attempt('local-storage', "localStorage.setItem('k', 'v'); return 'stored';"),
  attempt('cookie', "document.cookie = 'k=v'; return 'set';"),
  attempt('open-window', `return open('${originOf(outside)}/popup') ? 'opened' : 'refused: null';`),
  attempt('navigate-top', `top.location = '${originOf(outside)}/top'; return 'assigned';`),
  `<img src="${originOf(outside)}/image">`,
].join('\n');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
await page.goto(consoleOrigin);

const inPage = ({ shellUrl, html, mode }) =>
  new Promise((resolve) => {
    const seen = {};
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.referrerPolicy = 'no-referrer';
    addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return;
      const { type, name, outcome, height } = event.data;
      if (type === 'ready') {
        frame.contentWindow.postMessage(
          { type: 'render', html, variables: { '--chart-1': '#3b6cf6' } },
          '*',
        );
      }
      if (type === 'size') seen.height = height;
      if (type === 'probe') seen[name] = outcome ?? true;
    });
    if (mode === 'srcdoc') frame.srcdoc = html;
    else frame.src = shellUrl;
    document.body.append(frame);
    setTimeout(() => resolve(seen), 1500);
  });

const shellUrl = `${originOf(shell)}/`;
const srcdoc = await page.evaluate(inPage, { shellUrl, html: fragment, mode: 'srcdoc' });
const shelled = await page.evaluate(inPage, { shellUrl, html: fragment, mode: 'shell' });
const selfNavigation = await page.evaluate(inPage, {
  shellUrl,
  html: `<script>location.href = '${originOf(outside)}/self-navigation'</script>`,
  mode: 'shell',
});
const topAfter = page.url();

await browser.close();
for (const server of [outside, shell, consoleServer]) server.close();

const rows = [
  ['srcdoc frame under the console CSP: its script runs', srcdoc['script-ran'] === true],
  ['shell frame: the fragment script runs', shelled['script-ran'] === true],
  ['shell frame: reports its height', shelled.height],
  ['shell frame: fetch to another origin', shelled['fetch-outside']],
  ['shell frame: read the console document', shelled['read-parent']],
  ['shell frame: localStorage', shelled['local-storage']],
  ['shell frame: cookie', shelled.cookie],
  ['shell frame: open a window', shelled['open-window']],
  [
    'shell frame: navigate the top window',
    `${shelled['navigate-top']}, top stayed ${topAfter === `${consoleOrigin}/`}`,
  ],
  [
    'shell frame: navigate itself elsewhere',
    Object.keys(selfNavigation).length === 0 ? 'no message' : JSON.stringify(selfNavigation),
  ],
  ['requests that reached the outside origin', JSON.stringify(outsideHits)],
];
for (const [what, result] of rows) console.log(`${what}: ${result}`);
