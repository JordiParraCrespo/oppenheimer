// Apply the stored theme before first paint, so a returning dark-mode user
// never sees a white flash. Mirrors the default in
// src/components/theme-provider.tsx — light unless told otherwise.
//
// A file rather than an inline block in index.html, because the app is served
// under `script-src 'self'` (apps/web/nginx.conf). Admitting an inline script
// would mean either `'unsafe-inline'`, which gives up the directive that makes
// an injection a no-op, or a hash that silently stops matching the first time
// somebody edits these lines — and the failure is a white flash nobody
// attributes to a CSP. Same-origin and render-blocking in `<head>`, so it still
// runs before the first paint.
try {
  document.documentElement.classList.add(
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  );
} catch {
  document.documentElement.classList.add('light');
}
