# 16 — Orca in the browser, and agent logins across hosts

Two questions from the owner, researched together because Orca answers
them with the same primitive:

1. How does Orca authenticate a **web** client, given that it started as
   an Electron app?
2. How does Orca **share Claude Code and Codex logins across hosts**, and
   what can we do the same way?

Short answers: Orca authenticates a browser with a pairing link that a
running Orca runtime mints, one revocable token per paired client, and
has no hosted identity in front of it. And Orca does **not** share agent
logins across hosts at all: every host is logged in separately, the
docs say so in one sentence, and the product's UI is built around that
fact. Both answers confirm the MVP's current design (00-scope, 08-auth,
note 01 §7). The rest of this note is the detail, the vendor rules that
bound the space, and the small things we can add.

Read from the source, not only the docs: `stablyai/orca` at
`60c43695` (2026-09-22, v1.4.197), `src/main/runtime/` for pairing and
the web client, `src/main/claude-accounts/` and `src/main/codex-accounts/`
for logins, `cloud/` for the relay, `docs/site/content/docs/` for the
published pages. Where the source says more than the docs, the source
wins below and is cited by path.

## 1. How Orca authenticates in the web

Orca has three ways to reach a runtime that is not the machine in front
of you, and they share one auth model.

### Remote Orca Servers: pairing links, one token per client

A "Remote Orca Server" is the ordinary Orca runtime running on another
machine, either the desktop app with *Advertise this app as a server*
switched on, or headless with `orca serve --pairing-address <ip>`. The
server owns "projects, worktrees, terminals, tabs, provider accounts,
and agent sessions"; the client "shows the UI and sends your input".

Authentication is a **pairing link**, and the source says exactly what
is in it (`src/shared/mobile-relay-pairing-offer.ts`,
`src/main/runtime/runtime-rpc/runtime-rpc-pairing.ts`):

- The runtime keeps a **device registry** (`device-registry.ts`). A
  pairing offer creates a *pending* device with a 24-byte random
  `token`, a scope (`runtime` for desktop and browser clients, `mobile`
  for phones) and a *reach* (network or this-computer-only). The offer
  is a JSON object — version, WebSocket endpoint, the device token, the
  runtime's **Curve25519 public key**, the device id, the scope, and
  optionally a relay invite — base64url-encoded into
  `orca://pair?code=…`. So the link is not a bearer token alone: it also
  pins the runtime's key, and the client later proves the pairing by
  ECDH against it.
- The WebSocket listener **binds to loopback until a device is paired**
  and widens to all interfaces only on explicit pairing or under
  `orca serve` (`runtime-rpc-pairing-types.ts`, "STA-2370"). An operator
  can pin it to loopback for good. It speaks `wss://` with a
  self-signed certificate generated on first run, whose fingerprint the
  mobile app pins from the QR (`tls-certificate.ts`); the transport
  comment is blunt that "auth is per-device tokens, independent of
  transport encryption".
- The socket is authenticated by the device token; an unknown token is
  closed with `4001 Unauthorized`, and revoking a device terminates its
  live sockets (`revokeRuntimeAccess`, `mobile-socket-wiring.ts`).
  "Orca creates a separate, revocable token for each paired client";
  generating a new link replaces only the *unused* pending one.
- The docs say what the link is: "The pairing URL grants access to this
  Orca runtime. Treat it like a password and send it only to the client
  you intend to pair."

There is no user account in this path. The runtime is the identity
provider, the link is the credential, and the network is the perimeter:
the recommended setup is Tailscale on both ends, and the docs say "Do
not forward the Orca port directly to the public internet."


### The browser client: the runtime serves its own web bundle

The web client is the same renderer, served by the runtime itself:
`static-web-client-handler.ts` serves exactly `/web-index.html` plus
`/assets/`, `/cmaps/`, `/standard_fonts/` and `/wasm/`, nothing else.
`createWebClientUrl` turns a runtime-scoped pairing offer into
`http(s)://<endpoint>/web-index.html#pairing=<orca://pair?code=…>`; the
comment explains the fragment: "pairing URLs carry full credentials; the
fragment keeps them out of proxy logs and Referer headers". Opening it
pairs that browser as a `runtime`-scope device, and the grant is kept in
`localStorage` under a single-slot key (`orca.web.runtimeEnvironment.v1`),
so a browser holds one paired server at a time (issue #18846).

The limits follow from the design, and Orca's own issue tracker states
them:

- Reachability is the user's problem. "The addresses that link can
  advertise all assume the browser can already reach the machine — a
  LAN IP, a Tailscale address, or a tunnel the user wired up by hand.
  There is no supported path for 'open Orca in a browser from outside
  my network' without either a VPN or hand-rolled infrastructure."
  (issue #14039, asking for Cloudflare Tunnel as a pairing target.)
- Plain HTTP breaks browser APIs the client relies on (`crypto.randomUUID`
  is secure-context only; issues #16232, #19667).
- The browser client has no local execution host, so a headless
  `orca serve` had a whole class of bugs where server worktrees reported
  `hostId: "local"` and the web client took that to mean *itself*
  ("Local PTYs are unavailable in the web client", issue #9047).

### Mobile: a one-time code, and the one place Orca has a cloud account

The phone app pairs with the same offer (scope `mobile`, shown as a QR),
gets a device token, and then needs a path to the desktop: the LAN
address, or **Orca Relay**, Orca's hosted relay. The relay is in the
open repo under `cloud/`: "Phones and desktops never talk to each other
directly: each opens an outbound WebSocket to a relay cell, the relay
pairs the two sessions, and it splices frames between them", with a
director assigning hosts to cells, PostgreSQL, GCP, Terraform. Frames are
end-to-end encrypted with the X25519 key from the pairing offer, so the
relay splices ciphertext. A relay-mode offer carries a short-lived invite
(ten minutes) minted by the cell; "Anywhere" pairing fails closed rather
than silently shipping a LAN-only QR. The desktop authenticates to the
relay and to the push gateway with that same key, answering an encrypted
challenge. "Sign-in is required for Relay only", and both ends must be
"signed into the same Orca account"; the API and auth services behind
that sign-in live in the private `stablyai/orca-cloud`. That is the
whole of Orca's hosted identity: a relay you may opt into, never the
thing that authorises a runtime.

### What we take, and what we already have

Orca's answer to "web auth" is a pairing token minted by the machine and
a network you bring yourself. Ours is the inverse and we already built
it: the control plane is the identity (Better Auth, 08-auth), the host
pairs to *it* with a token a signed-in user mints, the runner dials out
so nothing on the host is reachable, and the browser attaches to a
session with a short-lived ticket the control plane mints (01-protocol).
Issue #14039 is literally the product gap that the hosted control plane
closes. Two Orca details are still worth taking:

- **A grant per client, listed and revocable.** Orca shows every paired
  client on the server and lets you revoke one. Our equivalent is the
  Better Auth session list plus the host row; the hosts drawer should
  show *which hosts this account has paired* with a revoke, which is
  already the plan (05-screens, later slice).
- **Account scope is stated on screen.** When a remote server is the
  active runtime, Orca's Accounts pane says "Account scope: Remote
  server `<name>`. The accounts managed on this desktop are left
  untouched." (issue #21466). Anything we show about an agent login
  must be labelled with the host it belongs to; see §3.

## 2. How Orca handles agent logins across hosts: it does not share them

The documentation is explicit, in the Remote Orca Servers page:

> Install and authenticate Codex, Claude Code, OpenCode, `git`, and any
> provider CLIs on the **server computer**. A login on your laptop does
> not automatically carry over to the server.

and: remote sessions use "the server's `PATH`, home directory, and
credentials — not the client's". On a headless server the login is a
CLI command run on that machine: `orca account add --agent claude` and
`orca account add --agent codex`. In the client UI, *Add account* and
*Re-authenticate* are **disabled** whenever the account scope is a
remote server, with a tooltip and toast that give the command to run on
the server (PR #20043, fixing #20009 where the button silently did
nothing). The reason in the PR is the one that matters: an interactive
login started from the client "would authenticate against the desktop,
not the server". The credential is issued to the CLI on the machine
where the flow ran, so the flow has to run on the machine that will use
it.

Users with two hosts therefore register every account on every host
("both registered on both machines via `orca account add`", #21466). No
sync, no copy, no vault. Orca's "sharing" is per-host discovery plus a
UI that switches which host's accounts you are looking at.

### The mechanics inside one host: Orca holds and refreshes the credential

Note 06 described Orca as "a viewer over files the vendor CLI already
owns". The source says otherwise, and the correction matters for what
we copy. On one host, for a *managed* account:

- **Login runs in a throwaway config dir and the credential is
  captured.** `claude-login-session.ts` creates a temporary
  `CLAUDE_CONFIG_DIR`, runs `claude auth login --claudeai` in it, then
  `claude auth status --json`, and `claude-auth-capture.ts` reads the
  resulting `.credentials.json` (or the config-dir-scoped Keychain item
  on macOS) plus the `oauthAccount` block of `.claude.json`. Codex is
  the same shape: `codex login` into a managed `CODEX_HOME`, then
  `auth.json` is read; `importAuthFromHome` copies an `auth.json` from
  any already-authenticated home into a managed one.
- **The credential is stored by Orca**, under its own root as
  `<accounts>/<id>/auth/.credentials.json` and `oauth-account.json`
  (`claude-managed-auth-storage.ts`), or in a Keychain item Orca names
  per account on macOS.
- **Orca refreshes the OAuth token itself.** `oauth-refresh.ts` posts
  `grant_type=refresh_token` to `https://platform.claude.com/v1/oauth/token`
  with Claude Code's public client id, "verified against the installed
  `claude` binary (2.1.177)", five minutes ahead of expiry, so that "a
  single-use refresh token is rotated and persisted atomically, instead
  of being scraped back after the CLI rotates it".
- **Selection materialises the credential into the runtime config dir**
  (`runtime-auth-sync.ts`): the chosen account's blob is written where
  the launched `claude` will read it, and on switch the runtime's blob
  is *read back* into the managed store so a refresh the CLI performed
  is not lost. Launches set `CLAUDE_CONFIG_DIR` and
  `CLAUDE_SECURESTORAGE_CONFIG_DIR` to that dir and, when a managed
  account is active, **strip** `ANTHROPIC_API_KEY`-style variables from
  the child environment (`environment.ts`, `stripAuthEnv`). The Keychain
  service name is derived exactly as the CLI does it, "first 8 hex chars
  of sha256(NFC(CLAUDE_CONFIG_DIR))" (`keychain.ts`).
- The WSL runtime keeps the selection as a variable only — "WSL managed
  accounts are isolated by their Linux `CLAUDE_CONFIG_DIR`; materializing
  into Windows `~/.claude` would mix two auth stores" — while the host
  runtime once wrote the selected account into the user's **default**
  `~/.claude`, so a personal terminal billed a work account for hours
  after Orca closed (#16016).

So Orca is a credential *manager* for the CLIs on one machine: it
captures the token, owns the file, performs the refresh, and swaps
tokens under the CLI. That is a lot of surface, and every item in
Orca's tracker about stale tokens, wrong-account billing and lost
refreshes (#16016, #13746, #20118, PR #21931) is that surface. Two
things it still never does: it never sends a credential off the host,
and it never lets a client machine log a server in. Lessons for us: the
selection must be an environment variable on the processes we spawn,
never a write to the host's default config dir; and we should not take
on the manager role at all (§4).
- Codex account selection was for a while coupled to whether Orca's
  status-hook trust could be granted; when it could not, Orca silently
  swapped `CODEX_HOME` to its managed home and a stale credential could
  be used (#13746). Lesson: credential routing and status-hook plumbing
  are separate concerns.
- **No other runtime gets the credential.** SSH worktrees (Orca's
  laptop-owned mode where a remote box runs selected worktrees) and the
  per-workspace cloud VMs from `orca.yaml` recipes carry none of this:
  `src/main/ssh/` and the `ephemeral-vm-*` services never mention
  `CLAUDE_CONFIG_DIR`, `CODEX_HOME` or a managed account, and the
  managed-account preparation is only wired into local launches and the
  local commit-message agent (`main-process-runtime-launch.ts`,
  `commit-message-agent-environment.ts`). The structured-launch policy
  says it outright: "Structured Claude always spawns a native local-host
  child — the launch resolver refuses any record with a remote execution
  host or a WSL distro". The docs match: an SSH target is a "good fit
  when the remote already has your repo, tools, and credentials".
- Sign-in links: Orca extracts the Codex login URL from the child
  process's stdout and shows a *Copy link / Open* notice; the notice is
  dropped when the login ends "since it dies with Codex's local callback
  server", and it is hidden in a remote account scope because it "would
  name a login running on this desktop" (#21372). The CLI reference
  states the rule for the headless path: "`account add` runs
  `claude login` / `codex login` in **this** terminal on the host, then
  registers the captured credentials with the local runtime. Codex uses
  device authorization so the browser can finish on another machine.
  Run these on the machine that owns the accounts — not through a
  client-only remote session."
- The Accounts pane names the scope from `activeRuntimeEnvironmentId`
  (`provider-account-scope.ts`): "Credentials and account checks for
  this provider are owned by this remote server" versus "owned by this
  desktop client", and while a server owns the roster, "Accounts managed
  on this desktop are unchanged."

- Usage meters were repeatedly read from the *desktop's* credentials
  while the active account was on the remote host (#16466, #21466). Any
  per-account figure we show must be produced on the host it belongs
  to, in the runner's heartbeat, as note 06 already says.

## 3. What the vendors permit, which is what bounds the answer

### Claude Code

- **Where the credential lives.** macOS Keychain, keyed to
  `CLAUDE_CONFIG_DIR` (hashed); Linux `~/.claude/.credentials.json`
  mode 0600; and on macOS, "when the Keychain rejects the write, such as
  when it's locked in an SSH session", the same file. That is the case
  for a Mac driven by our runner under launchd with no unlocked login
  Keychain, so both our platforms are file-based per config dir
  (note 06 §macOS).
- **Login without a reachable callback.** The docs cover our exact
  topology: "If your browser shows a login code instead of redirecting
  back after you sign in, paste it into the terminal at the `Paste code
  here if prompted` prompt. This happens when the browser can't reach
  Claude Code's local callback server, which is common in WSL2, SSH
  sessions, and containers." So the terminal-in-the-browser flow is:
  click the link, sign in on claude.ai, copy the code, paste it into the
  terminal. No port on the host is involved.
- **Policy on the token.** Anthropic's February 2026 clarification:
  "Using OAuth tokens obtained through Claude Free, Pro, or Max accounts
  in any other product, tool, or service — including the Agent SDK — is
  not permitted." Claude Code itself is the permitted surface. Our
  posture — run the unmodified CLI, never touch its credential — is what
  keeps every session inside that line; a platform that copied
  `.credentials.json` between hosts would be a third-party service
  handling the token, which is exactly the thing described.
- **No sanctioned copy or forwarding path.** The docs never describe
  moving `.credentials.json` between machines; the community does it
  (#29816, #44028) and reports it works, undocumented. A request for
  ssh-agent-style credential forwarding (`CLAUDE_AUTH_SOCK`, #49136) was
  closed as *not planned*. The documented headless path is
  `claude setup-token`: a one-year subscription OAuth token, printed
  once, meant for `CLAUDE_CODE_OAUTH_TOKEN` in CI, unable to use Remote
  Control or claude.ai connectors. Note 06 already places that in the
  project vault for unattended runs.
- **Expiry is visible.** Three-day warning before the login expires,
  `/status` reports `Expired — log in again`. The runner can read the
  same state through the screen manifest and flag `needs_login` (06).

### Codex

- **Where the credential lives.** `$CODEX_HOME/auth.json`, default
  `~/.codex`.
- **Login without a reachable callback.** The documented answer is
  device code: "select **Sign in with Device Code**" in the login UI or
  `codex login --device-auth`; it prints a short code you approve at
  chatgpt.com from any browser. The catch: device-code login must be
  **enabled by the ChatGPT workspace admin** (openai/codex #9253), and
  some workspaces have it off. The fallback is the browser flow with its
  callback on `localhost:1455` on the host, which a browser elsewhere
  cannot reach without a tunnel (`ssh -L 1455:localhost:1455`).
- **Copying the file is documented.** OpenAI's auth page: "If you can
  complete the login flow on a machine with a browser, you can copy your
  cached credentials to the headless machine", with `scp` and Docker
  examples and the warning "Treat `~/.codex/auth.json` like a password:
  it contains access tokens." So for Codex, a *person* moving their own
  `auth.json` between their own machines is a sanctioned thing. It is
  still not something the platform should do for them (§4).

## 4. What we do

Nothing in the MVP changes. Three points are confirmed and two small
things are added.

### Confirmed

1. **Log in once per host, on the host.** This is the MVP flow
   (00-scope "Agent login is the host's own"; open question 4 there is
   answered: let the login prompt appear), it is what Orca does, and it
   is the only flow both vendors document for our topology. The console
   never runs a login on the user's laptop on a host's behalf, for the
   reason Orca gives: it would authenticate the wrong machine.
2. **The platform never holds, copies or forwards a vendor credential**
   (F23, note 01 §7). For Claude this is a terms line; for Codex it is
   merely unnecessary. A hosted service copying `auth.json` between
   customers' hosts would be a credential store with the platform as a
   third party in the middle, and the moment a shared workspace exists
   it would let one person spend another's subscription. The per-host
   login keeps "one subscription, one human, one machine" true without
   the platform enforcing anything.
3. **Multiple accounts are per-host config dirs selected by an
   environment variable on the spawned process** (note 06), never a
   write to the host's default `~/.claude` or `~/.codex`. Orca's #16016
   is the bug we avoid by construction: our runner launches the agent
   inside the session's tmux with the variable set once (02-runner §6)
   and never edits the host's own directory.
   **And the runner does not become the credential manager Orca is.**
   Orca captures the token out of the login dir, stores it under its own
   root, refreshes it against the OAuth endpoint with the CLI's client
   id, and materialises it back before each launch. We do none of that:
   the login writes into the account's config dir directly, the CLI
   refreshes its own token, and the runner reads only presence, mtime
   and expiry. That keeps note 06's "the platform never reads the
   credential file's contents" true, keeps F23 trivially true, and skips
   the whole family of stale-token and lost-refresh bugs. The one thing
   we lose is Orca's atomic refresh across concurrent sessions on one
   account, which Orca needed because it swaps a blob under a running
   CLI; with one config dir per account and the CLI owning it, two
   sessions on the same account share one file the CLI already
   coordinates, the same as two terminals on a laptop.

### Added

4. **A "paste login code" affordance in the session view.** Claude's
   flow in our topology ends with a code the person must paste into the
   terminal; on a phone that is a copy from one tab and a paste into
   xterm.js, which works but is fiddly. When the screen manifest (02
   §9) sees the `Paste code here if prompted` state, the console shows
   an input beside the login button that writes the pasted code plus
   Enter to the PTY. Same for Codex's device code, in reverse: show the
   code large, with a copy button, next to the link. This is UI over
   the existing byte stream; no new protocol message. It joins the
   screen-manifest states for Claude (`login_url`, `login_code_prompt`)
   and Codex (`device_code`) in the manifests, and F3's allowlist of
   linkable hosts stays the only place a URL becomes a link.
5. **A per-host login status in the hosts drawer, labelled with the
   host.** Orca's remote-scope bugs (#16466, #21466, #20118) all come
   from showing a figure without saying which machine it came from. The
   runner already reports host facts in its heartbeat (02 §10); it adds
   `agents[]: {id, installed, version, loggedIn, expiresSoon}` derived
   from the CLI's own state files (`~/.claude/.credentials.json`
   presence and expiry, `/status`-equivalent; `auth.json` presence for
   Codex), read but never transmitted. The drawer shows "Claude Code ·
   logged in · expires in 3 days" per host and a *Log in* action that
   opens a session with the agent's login command, which is note 06's
   "Add account" flow with one account per host. No credential contents
   ever leave the host.

### Deferred, with the reason

- **Codex browser-flow callback through the relay.** When a workspace
  admin has device code disabled, the only Codex login path is the
  `localhost:1455` callback on the host. The relay *could* forward a
  browser request to that port for the duration of a login, which is
  the web equivalent of `ssh -L`. It is a new inbound-to-host surface
  (F-series review needed) for one vendor's opt-out case; the Codex
  slice decides. Until then the console tells the person to enable
  device-code login in their ChatGPT workspace, with the link.
- **`claude setup-token` in the vault for unattended runs.** Still the
  later slice in note 06; the MVP has nobody running unattended.
- **Per-account config dirs.** Note 06, later slice, unchanged.

## 5. Side by side

| | Orca | Us (MVP) |
|---|---|---|
| Who authenticates the browser | the runtime, via a pairing link it mints; Tailscale or LAN for reach | the control plane (Better Auth); the browser never reaches a host |
| Client credential | one revocable 24-byte device token per paired client plus the runtime's pinned X25519 key, in `localStorage` for the browser | cookie session; short-lived attach ticket per session socket (01) |
| Host credential | none: the server *is* the trust root; listener on loopback until paired, self-signed `wss` | runner key pair bound to the host row; pairing token minted by a signed-in user (08, 09) |
| Relay | optional hosted relay for phones, outbound WebSocket both ends, end-to-end encrypted, code in `cloud/` | the control plane relays every session; the runner dials out (01, 02) |
| Hosted account | optional, only for Orca Relay (mobile) and artifact publishing | required; it is the product |
| Agent login | once per host, on the host; `orca account add` headless; *Add account* disabled in remote scope | once per host, in the session terminal; link becomes a button, code gets a paste box |
| Sharing logins across hosts | none, by design and by docs | none, by design and by terms (F23) |
| Several accounts on one host | Orca captures, stores, refreshes and materialises the token per managed account; `CLAUDE_CONFIG_DIR` / `CODEX_HOME` on launch; once wrote into the default dir by mistake | note 06, later slice; env var on the spawned process only, the CLI owns and refreshes its own file |
| Credential on SSH hosts and cloud VMs | none carried; the remote must already be logged in | none carried (F23) |
| Where usage/login state is read | on the host that owns the account (after several bugs where it was not) | on the host, in the runner's heartbeat, labelled with the host |

## Sources

- Orca source, `stablyai/orca` at `60c43695` (v1.4.197, 2026-09-22):
  `src/shared/pairing.ts`, `src/shared/mobile-relay-pairing-offer.ts`,
  `src/main/runtime/device-registry.ts`, `e2ee-keypair.ts`,
  `tls-certificate.ts`, `runtime-rpc/runtime-rpc-pairing.ts`,
  `runtime-rpc/runtime-rpc-pairing-types.ts`,
  `runtime-rpc/runtime-rpc-mobile-pairing.ts`,
  `rpc/static-web-client-handler.ts`, `rpc/mobile-socket-wiring.ts`;
  `src/main/claude-accounts/claude-login-session.ts`,
  `claude-auth-capture.ts`, `claude-managed-auth-storage.ts`,
  `oauth-refresh.ts`, `keychain.ts`, `environment.ts`,
  `claude-structured-auth-policy.ts`, `runtime-auth/runtime-auth-sync.ts`;
  `src/main/codex-accounts/codex-login-session.ts`,
  `codex-managed-home-lifecycle.ts`;
  `src/renderer/src/components/settings/provider-account-scope.ts`;
  `cloud/README.md`; `docs/site/content/docs/remote-servers.mdx`,
  `cli/reference.mdx`, `ways-to-run.mdx`
- Orca docs: [Remote Orca Servers](https://www.onorca.dev/docs/remote-servers),
  [Ways to run Orca](https://www.onorca.dev/docs/ways-to-run),
  [Mobile companion](https://www.onorca.dev/docs/mobile),
  [Settings reference](https://www.onorca.dev/docs/settings),
  [Claude Code in Orca](https://www.onorca.dev/docs/agents/claude-code),
  [Codex hot swap](https://www.onorca.dev/docs/agents/codex-hot-swap),
  [SSH worktrees](https://www.onorca.dev/docs/ssh)
- Orca issues and PRs: [#14039 browser access link needs a tunnel](https://github.com/stablyai/orca/issues/14039),
  [#18846 web client single-slot server storage](https://github.com/stablyai/orca/issues/18846),
  [#9047 web client on headless serve](https://github.com/stablyai/orca/issues/9047),
  [#16232](https://github.com/stablyai/orca/issues/16232) / [#19667 plain-HTTP web client](https://github.com/stablyai/orca/issues/19667),
  [#20009 Add account does nothing on a remote runtime](https://github.com/stablyai/orca/issues/20009),
  [PR #20043 guidance in remote account scope](https://github.com/stablyai/orca/pull/20043),
  [#21466 account scope on a paired remote host](https://github.com/stablyai/orca/issues/21466),
  [#16466 usage meter reads the desktop account](https://github.com/stablyai/orca/issues/16466),
  [#16016 managed account written into the default `CLAUDE_CONFIG_DIR`](https://github.com/stablyai/orca/issues/16016),
  [#13746 Codex home coupled to hook trust](https://github.com/stablyai/orca/issues/13746),
  [PR #21372 sign-in link and abandoned logins](https://github.com/stablyai/orca/pull/21372),
  [#18666 Codex on WSL host missing from remote client](https://github.com/stablyai/orca/issues/18666)
- DeepWiki: [SSH and remote connections](https://deepwiki.com/stablyai/orca/2.5-ssh-and-remote-connections),
  [AI agent tracking and Codex accounts](https://deepwiki.com/stablyai/orca/7.3-ai-agent-tracking-and-codex-accounts)
- Claude Code: [Authentication](https://code.claude.com/docs/en/authentication)
  (credential storage, paste-code login, `setup-token`, precedence),
  [#49136 credential forwarding, closed not planned](https://github.com/anthropics/claude-code/issues/49136),
  [#44028 OAuth over SSH on macOS](https://github.com/anthropics/claude-code/issues/44028),
  [#29816](https://github.com/anthropics/claude-code/issues/29816),
  [#7100 headless auth docs](https://github.com/anthropics/claude-code/issues/7100)
- Anthropic policy on subscription OAuth in third-party tools:
  [The Register, 2026-02-20](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/),
  [claude-code #82266](https://github.com/anthropics/claude-code/issues/82266)
- Codex: [Authentication](https://learn.chatgpt.com/docs/auth)
  (device auth, `auth.json`, copying to a headless machine),
  [openai/codex #9253 device code needs workspace enablement](https://github.com/openai/codex/issues/9253)
