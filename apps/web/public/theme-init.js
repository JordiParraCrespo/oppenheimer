// Apply the stored theme before first paint, so a returning dark-mode user
// never sees a white flash. Mirrors the default in
// packages/frontend/web/src/theme/components/theme-provider.tsx: "Match system"
// unless this device chose, hence the media query. A file, not inline in
// index.html, because the app is served under `script-src 'self'`
// (apps/web/nginx.conf): `'unsafe-inline'` gives up what makes an injection a
// no-op, and a hash silently stops matching on the first edit. Render-blocking
// in `<head>`, so it still runs before first paint.
try {
  const stored = localStorage.getItem('theme');
  const dark =
    stored === 'dark' ||
    (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.add(dark ? 'dark' : 'light');
} catch {
  document.documentElement.classList.add('light');
}
