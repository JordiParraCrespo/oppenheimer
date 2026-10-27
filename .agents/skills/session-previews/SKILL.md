---
name: session-previews
description: Set up, check and troubleshoot sessions' previews, the session pane's Browser tab that shows a session's dev server through its host's runner, on the local stack and on a deployment (a preview domain, wildcard DNS and TLS, the Cloudflare tunnel's ingress, the console's CSP). Use it when asked to configure previews, a preview domain, "a tunnel to see the app from outside the machine", Cloudflare Tunnel, ngrok or a Vercel-style preview for a session, when the Browser tab says "Waiting for a dev server" or shows a blank or refused page, or when an app in a session (a front end with an API, hot reload, cookies, auth) does not work in the preview.
---

# Session previews

A session's dev server, in the console's Browser tab and from anywhere the
console opens. The design is `product/versions/mvp/30-session-previews.md`;
read it before changing anything here. In one breath:

```
browser ──► https://p5173-<session hex>.<preview domain>   (an origin per session and port)
              │  the API's preview listener (PREVIEW_PORT, apart from its own):
              │  PreviewProxyGateway, ticket → cookie, judged as an attach
              ▼
          the host's runner link (already open, outbound)   port.open / frames / credit
              ▼
          127.0.0.1:5173 on the host, as `localhost:5173`
```

The runner's link is the tunnel: nothing is installed on a host and nothing is
opened inbound. Cloudflare Tunnel, ngrok and the like are not needed for a
preview, and are not a substitute for this one (their logins do not survive
an iframe, and they show the app to whoever has the URL).

| Piece | Where |
| --- | --- |
| A session's ports, the TCP tunnel | `apps/runner/internal/ports/`, `apps/runner/internal/cli/link_ports.go` |
| The wire | `port.*` in `packages/shared/src/protocol/messages.ts` |
| Preview origins, the proxy, the rewriting | `apps/api/src/relay/infrastructure/preview-*.ts`, `link-port-stream.util.ts` |
| The ticket, the ports read | `apps/api/src/sessions/commands/issue-session-preview/`, `queries/find-session-ports/` |
| The tab | `apps/web/src/features/sessions/sections/session-browser*.tsx` |
| What the session's agent is told | `writeSessionNote` in `apps/runner/internal/cli/app_devices.go` |

It is on when the API has `PREVIEW_BASE_URL` (the `session_previews`
capability) and the `session_browser_preview` flag is on for the reader. The
API then serves previews on a listener of its own, `PREVIEW_PORT` (3011 by
default), so nothing of a preview passes through its request pipeline.

## 1. On the local stack

`node scripts/stack/stack.mjs up --web` already sets
`PREVIEW_BASE_URL=http://preview.localhost:3011` (`e2e/support/stub-env.ts`),
served on the preview port, 3011.
`*.localhost` resolves to the loopback in Chrome, Edge and Firefox, so
previews need no DNS. Safari does not resolve `*.localhost`: use Chrome.

Check it answers before opening the console:

```bash
curl -s localhost:3001/api/v1/health/capabilities | grep -o '"session_previews":[a-z]*'
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Host: p5173-00000000000000000000000000000000.preview.localhost:3011' localhost:3011/
# 401: the preview origin is served (it wants a ticket). Refused: PREVIEW_BASE_URL is unset.
```

To see it work end to end, pair a real runner (the `local-stack` skill), open
a session, and in its terminal start a dev server on any port from 1024
(`npx vite --port 5173`). The tab finds it within a few seconds.

## 2. On a deployment

What any deployment needs, whatever fronts it:

1. **A domain of its own for previews**, a different registrable domain from
   the console's (`example-preview.dev` beside `app.example.com`), never a
   subdomain of it: a preview runs what a session's agent wrote, and a
   sibling of the console could set cookies the console reads.
2. **Wildcard DNS and TLS** for `*.<preview domain>`, pointed at the API's
   preview port (`PREVIEW_PORT`, 3011),
   with `Host` passed through untouched and WebSockets allowed (hot reload).
   Nothing may rewrite the path or buffer responses (server-sent events).
3. **The API** with `PREVIEW_BASE_URL=https://<preview domain>` (an origin:
   no path; a port only if it is not the scheme's).
4. **The console's CSP** admitting the frame: `CSP_FRAME_ORIGINS` for the web
   image (`https://*.<preview domain>`), read by `apps/web/nginx.conf`.

### The dev deployment (`deploy/dev/`, one Cloudflare tunnel)

Everything above is one setting in `config/host.env` plus Cloudflare:

1. Add the preview domain to the same Cloudflare account as a zone of its
   own. Cloudflare's free Universal SSL covers `*.<zone>` (one level), which
   is why the domain is a zone and not `preview.dev.example.com` (two levels
   need an Advanced Certificate).
2. Route its wildcard to the existing tunnel:
   ```bash
   cloudflared tunnel route dns oppenheimer-dev '*.example-preview.dev'
   ```
3. On the server, `config/host.env`: `PREVIEW_HOSTNAME=example-preview.dev`.
   `oppctl` renders the tunnel's `*.<PREVIEW_HOSTNAME>` rule to the API's
   preview port
   (`cloudflared.yml.tmpl`, between `previews:begin` and `previews:end`) and
   compose sets the web image's `CSP_FRAME_ORIGINS` from it.
4. `config/api.env`: `PREVIEW_BASE_URL=https://example-preview.dev`.
5. Deploy (`oppctl deploy`), then check:
   ```bash
   curl -sI https://p5173-00000000000000000000000000000000.example-preview.dev/ | head -1   # 401
   curl -s https://dev.example.com/api/v1/health/capabilities | grep -o '"session_previews":[a-z]*'   # true
   ```

The preview's cookie is `SameSite=None; Secure; Partitioned` when framed: a
third-party cookie keyed to the console's site. Chrome, Edge and Firefox keep
it; Safari keeps partitioned cookies from 18.4. In a browser that refuses it,
Open in a new tab still works.

## 3. Making an app work in the preview

The app sees `localhost:<port>`: the relay rewrites `Host`, and `Origin` and
`Referer` that name the preview, and brings `localhost` redirects and cookie
domains back. Its cookies are made `SameSite=None; Secure; Partitioned`, so
an app's own sign-in sticks inside the console's frame on another site. So host checks (Vite's `allowedHosts`), Next's server-action
origin check and CSRF checks pass with no setting. What a preview cannot do
is let the page call **another port** directly: in the reader's browser,
`http://localhost:3001` is the reader's own machine.

Put the API behind the dev server, on the page's own origin:

| Dev server | Proxy `/api` to the API on 3001 |
| --- | --- |
| Vite (React, Vue, Svelte, SvelteKit, Remix, Astro) | `server: { proxy: { '/api': 'http://127.0.0.1:3001' } }` |
| Next.js | `async rewrites() { return [{ source: '/api/:path*', destination: 'http://127.0.0.1:3001/api/:path*' }] }` |
| Create React App | `"proxy": "http://127.0.0.1:3001"` in `package.json` |
| webpack-dev-server | `devServer: { proxy: [{ context: ['/api'], target: 'http://127.0.0.1:3001' }] }` |
| Angular | `proxy.conf.json` with `"/api": { "target": "http://127.0.0.1:3001" }`, `ng serve --proxy-config proxy.conf.json` |

and call it relatively (`fetch('/api/…')`, a base URL of `''` or `'/api'`,
never `VITE_API_URL=http://localhost:3001`). A server that renders pages
(Rails, Django, Laravel) already serves its API on its own origin.

- **Listen on localhost or every address**, on a port from 1024. A server
  bound to one LAN address, or below 1024, is not offered.
- **Start it from the session** (its terminal, or the agent): the runner
  offers only ports whose process carries the session's `OPPENHEIMER_SESSION`.
  A container (`docker compose up`) listens as Docker's proxy, not the
  session: open the dev server in front of it, which proxies to it.
- **Hot reload needs nothing.** Do not set Vite's `hmr.clientPort`/`hmr.host`
  or Next's `assetPrefix` for the preview: they would point the browser at
  the host.
- **Absolute URLs the app builds** from its own config (an OAuth callback, an
  email link) still say `localhost`; that is the app's setting, not the
  preview's.

The runner tells the session's agent the same in the `CLAUDE.md` it writes
beside the checkout (`writeSessionNote`).

## 4. When it does not work

| The tab says, or shows | Look at |
| --- | --- |
| No Browser tab | `session_previews` false (no `PREVIEW_BASE_URL`), or the flag is off for the reader |
| Waiting for a dev server | `ss -ltnp` on the host: the port, its address (§3), and whether the process is the session's (`tr '\0' '\n' < /proc/<pid>/environ \| grep OPPENHEIMER_SESSION`) |
| This host can't share its ports | the runner predates `port.forward`, or it runs on a platform with neither `/proc` nor `lsof` |
| A blank frame | the console's CSP (`frame-src`, `CSP_FRAME_ORIGINS`) or a browser refusing the cookie (§2); the frame's own console says which |
| "This preview opens from its session in the console." | the cookie: expired (12 hours), refused by the browser, or for another port |
| "Nothing answered on port …" | the server stopped, or listens on another address than the one it was found on |
| The page loads, its API calls fail | the page calls another port directly (§3) |
| Hot reload never connects | `hmr.clientPort`/`host` set in the app's config (§3), or a proxy in front of the API that refuses WebSockets |

The proxy's logs are the API's (`PreviewProxyGateway`, which logs "previews
listening" with its port at boot); the runner's are
`port`-prefixed attachments in its own log.

## 5. A public link (not built)

Showing a build to someone without an account is the open question in note
30: a share link through the relay, or cloudflared/ngrok as providers behind
one interface (`.agents/rules/provider-integrations.md`). Until then, a
person who wants one runs it themselves on the host
(`cloudflared tunnel --url http://localhost:5173`) and owns what that exposes:
the dev server, with its file-serving routes, to anyone with the URL.
