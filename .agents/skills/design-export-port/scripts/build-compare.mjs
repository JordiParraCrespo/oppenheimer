#!/usr/bin/env node
/**
 * Build the review page: each design frame beside what the port draws for
 * it, light and dark, so the person who approved the frames can check the
 * port without running anything.
 *
 *   node build-compare.mjs --manifest compare.json --out /tmp/compare
 *
 * The manifest names the captures the two shooters wrote (render-artboards
 * for the frames, shoot-showcase or a console capture for the port):
 *
 *   {
 *     "title": "Host offline and file drop",
 *     "eyebrow": "Design system · 2026-10-03 export",
 *     "intro": "One paragraph: what was ported and how to read the page.",
 *     "changes": [{ "name": "TerminalBanner", "text": "What it is and where it shows." }],
 *     "pairs": [{
 *       "id": "offline-bar", "title": "Host offline, banner", "where": "terminal.tsx",
 *       "frame": "/tmp/shots/SessionsConsole-offbar-{theme}.png",
 *       "port": "/tmp/sc/showcase-{theme}-hostlink-offline.png",
 *       "notes": ["Anything a reader would otherwise flag as a mismatch."]
 *     }]
 *   }
 *
 * `{theme}` expands to light and dark. Every image is copied into
 * `<out>/shots/`, so `<out>` is self-contained: publish `index.html` with the
 * shots as its files. A missing capture fails the build, so the page never
 * ships a broken image.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { args } from './lib/browser.mjs';

const a = args({ manifest: {}, out: { default: '/tmp/compare' } });
if (!a.manifest) throw new Error('--manifest <file> is required');
const m = JSON.parse(readFileSync(resolve(a.manifest), 'utf8'));
const out = resolve(a.out);
mkdirSync(join(out, 'shots'), { recursive: true });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const missing = [];

/** Copy both themes of one capture; return the published name pattern. */
function take(pattern, as) {
  // Without the placeholder both themes would copy one file, and the page
  // would show the same shot under Light and Dark.
  if (!pattern.includes('{theme}')) throw new Error(`"${pattern}": a capture path must contain {theme}`);
  for (const theme of ['light', 'dark']) {
    const from = pattern.replaceAll('{theme}', theme);
    if (!existsSync(from)) missing.push(from);
    else copyFileSync(from, join(out, 'shots', `${as}-${theme}.png`));
  }
  return as;
}

const pairs = m.pairs.map((p) => ({
  ...p,
  frameAs: take(p.frame, `${p.id}-frame`),
  portAs: take(p.port, `${p.id}-port`),
}));
if (missing.length) throw new Error(`missing captures:\n  ${missing.join('\n  ')}`);

const changes = (m.changes ?? [])
  .map((c) => `<li><b>${esc(c.name)}</b><span>${esc(c.text)}</span></li>`)
  .join('');
const sections = pairs
  .map(
    (p) => `
  <section class="pair" id="${esc(p.id)}">
    <div class="head"><h2>${esc(p.title)}</h2>${p.where ? `<code>${esc(p.where)}</code>` : ''}</div>
    <div class="row">
      <figure><figcaption><span class="tag">Frame</span>Claude Design</figcaption><div class="shot"><img data-src="${p.frameAs}" alt="${esc(p.title)}, design frame" loading="lazy"></div></figure>
      <figure><figcaption><span class="tag">Port</span>Design system</figcaption><div class="shot"><img data-src="${p.portAs}" alt="${esc(p.title)}, as the design system draws it" loading="lazy"></div></figure>
    </div>
    ${p.notes?.length ? `<ul class="notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  </section>`,
  )
  .join('');

// Body content only: an Artifact publish wraps it in its own document
// skeleton (charset, viewport, safe-area padding), so the page starts at its
// title and styles.
const html = `<title>${esc(m.title)}</title>
<style>
:root{--bg:#f5f5f7;--card:#fff;--fg:#1d1d1f;--muted:#6e6e73;--subtle:#86868b;--line:#e3e3e8;--accent:#0071e3;--chip:#ececf0;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121213;--card:#1a1a1c;--fg:#f5f5f7;--muted:#a1a1a6;--subtle:#86868b;--line:#2c2c30;--accent:#2997ff;--chip:#27272b;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#121213;--card:#1a1a1c;--fg:#f5f5f7;--muted:#a1a1a6;--subtle:#86868b;--line:#2c2c30;--accent:#2997ff;--chip:#27272b;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.47 system-ui,sans-serif;letter-spacing:-.011em}
.wrap{max-width:1480px;margin:0 auto;padding-inline:16px;padding-block:40px 80px;display:flex;flex-direction:column;gap:40px}
header{display:flex;flex-direction:column;gap:10px;max-width:760px}
.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
h1{margin:0;font-size:34px;font-weight:600;letter-spacing:-.022em;line-height:1.15;text-wrap:balance}
h2{margin:0;font-size:21px;font-weight:600;letter-spacing:-.014em}
p{margin:0;color:var(--muted);max-width:68ch}
.controls{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:10px 0;background:var(--bg)}
.seg{display:inline-flex;gap:2px;padding:3px;border-radius:980px;background:var(--chip)}
.seg button{font:inherit;font-size:13px;border:0;background:none;color:var(--muted);height:30px;padding:0 14px;border-radius:980px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--card);color:var(--fg)}
.seg button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.changes{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px 28px;padding:0;margin:0;list-style:none}
.changes li{padding:10px 0;border-top:1px solid var(--line);font-size:14px}
.changes b{font-weight:600;display:block}.changes span{color:var(--muted);font-size:13px}
.pair{display:flex;flex-direction:column;gap:14px}
.head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}
.head code{font:12.5px ui-monospace,monospace;color:var(--subtle)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
figure{margin:0;display:flex;flex-direction:column;gap:8px;min-width:0}
figcaption{font-size:12.5px;color:var(--muted);display:flex;gap:8px;align-items:center}
.tag{font-size:11px;padding:2px 8px;border-radius:980px;background:var(--chip);color:var(--fg)}
.shot{border-radius:14px;overflow:hidden;border:1px solid var(--line);background:var(--card);line-height:0}
.shot img{width:100%;height:auto;display:block}
.notes{font-size:13px;color:var(--muted);margin:0;padding-left:18px;max-width:90ch}.notes li+li{margin-top:4px}
@media (max-width:860px){.row{grid-template-columns:1fr}h1{font-size:27px}}
</style>
<div class="wrap">
  <header><span class="eyebrow">${esc(m.eyebrow ?? '')}</span><h1>${esc(m.title)}</h1><p>${esc(m.intro ?? '')}</p></header>
  <div class="controls" role="toolbar" aria-label="View">
    <div class="seg" id="theme"><button type="button" data-pick="light" aria-pressed="true">Light</button><button type="button" data-pick="dark" aria-pressed="false">Dark</button></div>
  </div>
  ${changes ? `<section style="display:flex;flex-direction:column;gap:12px"><h2>What was added</h2><ul class="changes">${changes}</ul></section>` : ''}
  ${sections}
</div>
<script>
let theme = 'light';
try { const t = localStorage.getItem('cmp-theme'); if (t === 'light' || t === 'dark') theme = t; } catch {}
function paint() {
  for (const img of document.querySelectorAll('img[data-src]')) img.src = 'shots/' + img.dataset.src + '-' + theme + '.png';
  for (const b of document.querySelectorAll('[data-pick]')) b.setAttribute('aria-pressed', String(b.dataset.pick === theme));
}
document.getElementById('theme').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  theme = b.dataset.pick; try { localStorage.setItem('cmp-theme', theme); } catch {}
  paint();
});
paint();
</script>
`;
writeFileSync(join(out, 'index.html'), html);
console.log(`${basename(out)}/index.html: ${pairs.length} pairs, ${pairs.length * 4} shots`);
