// Starts the session lookup before the app bundle has even been fetched.
//
// Nothing renders until `useSessionRestore` resolves, and that request used to
// begin only after the bundle had downloaded, parsed and mounted React — one
// round trip stacked on the end of everything else. Kicking it off here, from a
// render-blocking script in <head>, overlaps it with bundle parse instead;
// `consumeSessionPreload` in @oppenheimer/auth picks up the promise.
//
// A file rather than an inline block for the same reason as theme-init.js: the
// app is served under `script-src 'self'` (apps/admin-web/nginx.conf), with no
// inline-script exception.
//
// Resolving to `undefined` means "no usable answer" — the app then asks the
// auth client normally, so the worst case is one wasted request, never a
// reader wrongly treated as signed out.
window.__OPPENHEIMER_SESSION_PRELOAD__ = fetch('/api/auth/get-session', {
  credentials: 'same-origin',
  headers: { accept: 'application/json' },
})
  .then((response) => (response.ok ? response.json() : undefined))
  .catch(() => undefined);
