// Loads this design system into the template. In a consuming project, point
// base at the bound DS folder relative to this file (e.g. '_ds/<folder>' at
// the project root, '../_ds/<folder>' one level down) — one line to edit.
(() => {
  const base = '../_ds/oppenheimer-design-system-9a255601-c6ba-4ec0-b1ab-7c66dbad2e38';
  for (const p of ["styles.css"]) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = base + '/' + p;
    document.head.appendChild(l);
  }
  const s = document.createElement('script');
  s.src = base + '/_ds_bundle.js';
  s.onerror = () => console.error('ds-base.js: failed to load ' + s.src + ' — if this is a consuming project, point the base line in ds-base.js at the bound _ds/<folder> tree relative to this page (e.g. _ds/<folder> at the project root, ../_ds/<folder> one level down); in a fresh design system this can just mean the bundle is not compiled yet');
  document.head.appendChild(s);

  // version1 dark theme: the system's true black reads as a void behind a
  // terminal that is also black, so the sidebar edge was the only thing you
  // could see. These aliases lift the whole ramp off zero and pull canvas,
  // sidebar and terminal within a few percent of each other — depth stays
  // tonal, just quieter. Loaded after styles.css, so these win on order.
  const o = document.createElement('style');
  o.textContent = `
:root{
  --background:#f5f5f7;
  --sidebar:#fafafb;
  --sidebar-border:#e6e6ea;
  --term-bg:#ffffff;
  --term-border:#e6e6ea;
}
[data-theme="dark"]{
  --canvas:#121213;
  --background:#121213;
  --sidebar:#161618;
  --sidebar-border:#232326;
  --card:#1a1a1c;
  --popover:#202023;
  --field:#1e1e21;
  --field-border:#35353a;
  --control:#2a2a2e;
  --control-hover:#343439;
  --control-active:#3d3d43;
  --border:#333338;
  --border-subtle:#262629;
  --border-strong:#45454b;
  --term-bg:#1a1a1c;
  --term-border:#262629;
}
/* The rail is the one glass surface in the app: it floats over the canvas and
   over an expanded terminal pane, so it reads as translucent rather than as
   another opaque tier. */
.op-sidebar{
  background:color-mix(in srgb, var(--sidebar) 72%, transparent);
  backdrop-filter:blur(20px) saturate(180%);
  -webkit-backdrop-filter:blur(20px) saturate(180%);
}`;
  document.head.appendChild(o);

  // Pages that don't own a theme control (the auth and onboarding screens)
  // follow the OS. A page that sets data-theme itself — the console — wins,
  // because this only ever writes when the attribute is absent.
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const el = document.documentElement;
  if (!el.hasAttribute('data-theme')) {
    el.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
  }
})();
