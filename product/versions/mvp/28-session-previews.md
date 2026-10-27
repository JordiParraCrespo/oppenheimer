# 28 — Session previews: the Browser tab

A session's dev server, open in the console beside its terminal and from
anywhere the console opens. Asked for on 2026-10-26 ("build the browser. I
would like to have some tunnel technology like the tunnel from cloudflare or
vercel localhost or ngrok and I can see the web from outside the machine. But
we should configure it properly"), then, offered the runner's own link as the
tunnel: "I like it. Make sure that in case for instance we are building an
app that connect with an api will work". It is the preview slice parked in
`../../07-mvp.md` §9 and sketched as "port forwarding as an attachment kind"
in `../../research/lessons-from-digitalocean-managed-agents.md` (item 7),
built as the design's Browser tab (`design/version1/SessionsConsole.dc.html`).

## Why the runner's link, not a third-party tunnel

The runner already dials out to the control plane and holds that socket
(01). That socket is the tunnel: a port on the host reaches a browser the
way a PTY does, as one more attachment, with nothing opened inbound on the
host and nothing installed on it. Cloudflare Tunnel, ngrok or a Vercel-style
share would add, on every host, a binary, an account, a token and an access
policy to keep in step with who may open the session; their logins are
cookies of another site, which browsers now refuse inside an iframe, so the
pane would have to open in a new tab. The relay checks the same thing a
terminal's attach checks, on the same interval.

What it costs: every byte of the preview crosses the API process, so a
preview is as fast as the relay (fine for a dev server, not for streaming
video), and it needs a wildcard host name (below). A public share link,
which is what those tunnels are best at, is not in this slice; when it
comes, cloudflared or ngrok are its candidates, as providers behind one
interface (`.agents/rules/provider-integrations.md`).

## Decided

**An origin per session and port.** A preview lives at
`p<port>-<session id, hex>.<preview domain>`, for example
`http://p5173-1f0c….preview.localhost:3011` on the local stack. One origin
per port means the app sees a root path, its own cookies and its own
storage, exactly as on `localhost:5173`, and two sessions' apps can never
read each other's. The preview domain is `PREVIEW_BASE_URL` (scheme, domain,
port); unset, previews are off and the console does not offer the tab.

- **Never the console's origin**, and in production not even its
  registrable domain: a preview runs whatever the session's agent wrote, so
  it must not be able to set a cookie the console reads. A domain of its
  own (`<product>-preview.dev`) also takes Cloudflare's free wildcard
  certificate, which covers one level only; `*.preview.<console domain>`
  needs a paid one.
- **On the local stack** `*.localhost` resolves to the loopback in every
  browser, so `preview.localhost` needs no DNS.

**Who may open it: the attach rule, by ticket then cookie.** The console asks
`POST /v1/sessions/:id/previews {port}` and gets a URL carrying a single-use
ticket that lives 60 seconds, minted on the same rule as a member's attach
ticket (`update Session` in the session's workspace, its host still the
member's to use). A share link opens no preview in this slice: a guest
watches the terminal. The preview origin redeems it at
`/__oppenheimer/enter`, sets its own cookie and redirects to the path asked
for. The cookie is signed, names the session, port and person, and lasts 12
hours; the relay judges the person again at most every 60 seconds, so a
revoked share or a closed session ends the preview as it ends a terminal.

- The cookie is `HttpOnly`, `Secure` and `SameSite=None; Partitioned` when
  the console frames the preview: partitioned by the console's site, so
  another site that frames or posts to the preview carries no cookie. Open
  in a new tab mints a fresh ticket and sets a `SameSite=Lax` one instead.
- Every preview answer carries `frame-ancestors` naming the console's
  origin: only the console frames a preview.
- The cookie is taken off the request before it reaches the app.

**The app sees `localhost`.** The relay forwards raw TCP, so HTTP/1.1, keep-
alive, server-sent events and WebSockets (a dev server's hot reload) all
pass as they are. On the way in it rewrites `Host`, and `Origin` and
`Referer` when they name the preview, to `localhost:<port>`: Vite's host
check, Next's server-action origin check and a CSRF check all see what they
see locally, so the app needs no setting for the preview. On the way out it
rewrites a `Location` that names `localhost:<port>` or `127.0.0.1:<port>`,
and drops `Domain` from `Set-Cookie`.

**An app with an API.** The usual shape works untouched: the page calls
`/api/...` on its own origin and the dev server proxies it to the API on the
host (Vite's `server.proxy`, Next's `rewrites`), so one forwarded port serves
both, cookies and CORS included. A page that calls `http://localhost:3001`
from the browser cannot work from anywhere but the host itself: in the
reader's browser `localhost` is the reader's machine, through this or any
tunnel. The session's agent is told so (its `CLAUDE.md` beside the checkout
says to put the API behind the dev server's proxy), and the
`/session-previews` skill says how for the common dev servers. Any other
port the session listens on is still a preview of its own (the API's
`/docs`, a second app).

**Which ports.** Only what the session's own processes listen on, from 1024
up: the runner lists listening TCP sockets and keeps those whose process
carries the session's `OPPENHEIMER_SESSION` in its environment, which every
process the agent starts inherits, a daemonized one included. It is stricter
than DigitalOcean's because a host may be someone's laptop: a preview never
reaches a port the session did not open (the person's own database, another
session's app, the runner). On Linux the runner reads `/proc`; on macOS
`lsof` and `ps`.

**On the wire (additions to 01).** One capability, `port.forward`.

| Message | Way | What |
|---|---|---|
| `port.list {commandId, sessionId}` | → runner | the session's listening ports |
| `port.listing {commandId, ports[{port, process}]}` | ← runner | the answer, through `LinkRepliesPort` |
| `port.open {commandId, sessionId, attachmentId, port}` | → runner | dial the port; refused with `command.failed` (`PORT_001` not the session's port, `PORT_002` nothing answers) |
| `port.opened {attachmentId}` | ← runner | dialled; bytes may flow |
| binary frames | both | the TCP bytes, under the attachment id |
| `attachment.credit` | both | the window, 256 KB each way: the runner credits what it wrote to the socket, the relay what the browser's response took |
| `port.close {attachmentId}` / `attachment.closed` | → / ← | either end hangs up |

One attachment is one TCP connection, as the browser's own connection to
the dev server would be.

**The tab.** The design's: Browser and Simulator as pill tabs, the address
(`localhost:5173`) and the process on it, a picker of the session's ports,
Reload, Open in a new tab. Waiting for the dev server is the tab's empty
state, polled while the pane is open. Behind `session_browser_preview`.

## As built (2026-10-27)

- Previews have a listener of their own on the API process, `PREVIEW_PORT`
  (3011), so the API's request path (Nest, Better Auth, its middleware)
  never sees a preview's request, and the preview proxy owns all of its
  own. The flow control is the link's one credit window, written down once
  in the protocol (`ports.ts`) and kept by `flowWindow` on the runner and
  `CreditWindow` on the control plane.
- `PREVIEW_BASE_URL` turns it on (the `session_previews` capability); the
  local stack sets `http://preview.localhost:3011`, the dev deployment a
  zone of its own (`deploy/dev`, `PREVIEW_HOSTNAME`). The `/session-previews`
  skill walks both, and what an app needs.
- The tab opens on the likeliest dev server among the session's ports
  (5173, 4200, 4321, 3000…), so a session that runs its API on 3002 beside
  Vite opens on the page; the picker opens any other.
- Verified end to end on the local stack: a real runner and session, Vite
  and an API on 3002 started from the session's terminal; the frame drew
  the page, its `/api` call answered through Vite's proxy, an edit reached
  it by hot reload without a reload, and 3002 opened on its own.
- The runner's agent note (`CLAUDE.md` beside the checkout) carries a
  "Previewing what you build" section.

## Open questions

- A public share link with an expiry, for showing a build to someone
  without an account: through the relay with a link token, or a
  cloudflared/ngrok provider.
- The relay is one process today (the link registry is in memory). A
  second API replica needs the preview request routed to the replica that
  holds the host's link, as the attach socket will.
- Whether a preview should be a URL the agent can print (`OPPENHEIMER_PREVIEW_URL`),
  which needs the ticket flow to start from a link the person clicks.
