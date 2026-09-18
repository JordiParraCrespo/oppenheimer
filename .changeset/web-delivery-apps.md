---
"@oppenheimer/web": minor
"@oppenheimer/admin-web": minor
---

Make the web delivery path carry its weight: compression, caching, a real CSP,
and a budget that keeps first load honest.

The built SPAs were served by a 14-line nginx config that set none of the three
things nginx does not do by default. The official image ships `gzip` commented
out, so the ~1.1MB entry chunk went over the wire uncompressed; hashed assets
got no `Cache-Control`, so every repeat visit revalidated all ~50 chunks; and
the Content-Security-Policy that `index.html` and `public/theme-init.js` were
already written against — both keep the theme bootstrap in a separate file
specifically to avoid an inline-script exception — did not exist. All three are
now set, with the policy's third-party origins in one substituted
`CSP_EXTRA_ORIGINS` variable (defaulted in the Dockerfile, overridable per
deployment through `helm/oppenheimer/values.yaml`). Measured on the current build:
1,130KB → 324KB for the entry chunk, 152KB → 24KB for the stylesheet.

On the critical path itself:

- **The session lookup starts before the bundle parses.** Nothing renders until
  `useSessionRestore` resolves, and that request used to begin only after the
  bundle had downloaded, parsed and mounted React. `public/session-preload.js`
  issues it from `<head>`.
- **Route chunks are prefetched on intent.** `defaultPreload: 'intent'` means
  hovering a link fetches the route it points at, instead of every navigation
  starting a request.
- **Dependencies are chunked per library**, so a release invalidates app code
  (42KB) and leaves the vendor chunks cached (263KB). Splitting costs ~48KB
  gzipped on a cold first load, which is the trade the `immutable` caching
  above pays for.

And so it stays fixed: `pnpm check:bundle` gzips everything the built
`index.html` references and fails past a committed budget, in CI after
`pnpm build`. Vite's own 500KB warning prints and passes, which is how a 1.1MB
entry chunk went unnoticed.
