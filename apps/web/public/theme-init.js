// Apply the stored theme before first paint, so a returning dark-mode user
// never sees a white flash. Mirrors the default in
// packages/frontend/web/src/theme/components/theme-provider.tsx — "Match
// system" unless this device chose for itself, which is why the media query
// is read here too and not only the stored value.
//
// A file rather than an inline block in index.html, because the app is served
// under `script-src 'self'` (apps/web/nginx.conf). Admitting an inline script
// would mean either `'unsafe-inline'`, which gives up the directive that makes
// an injection a no-op, or a hash that silently stops matching the first time
// somebody edits these lines — and the failure is a white flash nobody
// attributes to a CSP. Same-origin and render-blocking in `<head>`, so it still
// runs before the first paint.
try {
  const stored = localStorage.getItem('theme');
  const dark =
    stored === 'dark' ||
    (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.add(dark ? 'dark' : 'light');
} catch {
  document.documentElement.classList.add('light');
}
