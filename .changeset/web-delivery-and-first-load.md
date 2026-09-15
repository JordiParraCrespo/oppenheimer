---
"@oppenheimer/web": minor
"@oppenheimer/admin-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/auth": minor
"@oppenheimer/config": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/api-client": patch
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

- **Only the default locale is bundled.** `@oppenheimer/translations` grew two
  narrower entrypoints — `/locales` for metadata and `/lazy` for one catalog per
  chunk — because importing `locales` or `Messages` from the root barrel put
  every catalog in the entry chunk. The Spanish catalog was measurably inside
  what an English reader downloaded before anything rendered.
- **The session lookup starts before the bundle parses.** Nothing renders until
  `useSessionRestore` resolves, and that request used to begin only after the
  bundle had downloaded, parsed and mounted React. `public/session-preload.js`
  issues it from `<head>`; `consumeSessionPreload` in `@oppenheimer/auth` takes the
  answer once, and falls back to the auth client for anything unusable, so the
  worst case is a wasted request rather than a reader treated as signed out.
- **Route chunks are prefetched on intent.** `defaultPreload: 'intent'` means
  hovering a link fetches the route it points at, instead of every navigation
  starting a request.
- **Dependencies are chunked per library** via a shared
  `@oppenheimer/config/vite-chunks.mjs`, so a release invalidates app code (42KB) and
  leaves the vendor chunks cached (263KB). Splitting costs ~48KB gzipped on a
  cold first load, which is the trade the `immutable` caching above pays for —
  the number is recorded in that file.
- `sideEffects` declared on `@oppenheimer/design-system-web` (CSS excepted),
  `@oppenheimer/translations` and `@oppenheimer/api-client`, worth ~7KB gzipped.

And so it stays fixed: `pnpm check:bundle` gzips everything the built
`index.html` references and fails past a committed budget, in CI after
`pnpm build`. Vite's own 500KB warning prints and passes, which is how a 1.1MB
entry chunk went unnoticed. The Playwright `api` project runs in CI too — 69
specs that existed and that no job ran, five of which had been failing since the
console mailbox line gained a `Locale:` segment the e2e helper never learned
about. The `web` project stays out until it is repaired: it drives a `/team`
route `apps/web` no longer has, and 15 of its 64 specs fail on `main`. See
`e2e/README.md`.
