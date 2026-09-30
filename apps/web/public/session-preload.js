// Starts the session lookup from a render-blocking <head> script, so it
// overlaps bundle parse instead of waiting for React to mount; nothing renders
// until `useSessionRestore` resolves. `consumeSessionPreload` in
// @oppenheimer/auth picks up the promise. A file, not inline, because the app
// is served under `script-src 'self'` (apps/web/nginx.conf). `undefined` means
// "no usable answer": the app asks the auth client normally, so the worst case
// is a wasted request, never a reader wrongly treated as signed out.
window.__OPPENHEIMER_SESSION_PRELOAD__ = fetch('/api/auth/get-session', {
  credentials: 'same-origin',
  headers: { accept: 'application/json' },
})
  .then((response) => (response.ok ? response.json() : undefined))
  .catch(() => undefined);
