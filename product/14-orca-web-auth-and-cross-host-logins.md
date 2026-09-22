# 14 — Orca in the browser, and agent logins across hosts

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

## 1. How Orca authenticates in the web

Orca has three ways to reach a runtime that is not the machine in front
of you, and they share one auth model.

### Remote Orca Servers: pairing links, one token per client

A "Remote Orca Server" is the ordinary Orca runtime running on another
machine, either the desktop app with *Advertise this app as a server*
switched on, or headless with `orca serve --pairing-address <ip>`. The
server owns "projects, worktrees, terminals, tabs, provider accounts,
and agent sessions"; the client "shows the UI and sends your input".

Authentication is a **pairing link**:

- The server mints a link in Settings → Remote Orca Servers → New Link
  (or prints one from `orca serve`), bound to an address the server
  chooses — its Tailscale address by default.
- The client pastes the link into Add Server. "Orca creates a separate,
  revocable token for each paired client." Grants are listed on the
  server and revoked with a trash button.
- The docs say what the link is: "The pairing URL grants access to this
  Orca runtime. Treat it like a password and send it only to the client
  you intend to pair."

There is no user account in this path. The runtime is the identity
provider, the link is the credential, and the network is the perimeter:
the recommended setup is Tailscale on both ends, and the docs recommend
nothing else.

### The browser client: the runtime serves its own web bundle

The web client is the same renderer, served by the runtime itself at
`/web-index.html`. *Share this host* mints an access link of the form
`http://<address>:6768/web-index.html#pairing=…`; opening it in a
browser pairs that browser the same way a desktop client is paired, and
the grant is kept in `localStorage` under a single-slot key
(`orca.web.runtimeEnvironment.v1`), so a browser can hold one paired
server at a time (issue #18846).

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

The phone app pairs with a one-time code shown on the desktop, gets a
device token, and then needs a path to the desktop: the LAN address, or
**Orca Relay**, Orca's hosted relay. "Sign-in is required for Relay
only", and both ends must be "signed into the same Orca account". The
same account family also gates artifact publishing. That is the whole of
Orca's hosted identity: a relay you may opt into, never the thing that
authorises a runtime.

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

### The mechanics inside one host, for completeness

Note 06 covers this; the newer issues sharpen it:

- A *managed* account has its own runtime home. Orca materialises the
  account's credential into that home and launches agents with
  `CLAUDE_CONFIG_DIR` / `CODEX_HOME` pointing at it. On macOS the
  Keychain item is scoped to that directory. Orca's WSL runtime does it
  right — "WSL managed accounts are isolated by their Linux
  `CLAUDE_CONFIG_DIR`; materializing into Windows `~/.claude` would mix
  two auth stores" — while the host runtime once wrote the selected
  account into the user's **default** `~/.claude`, so a personal
  terminal billed a work account for hours after Orca closed (#16016).
  Lesson: the selection must be an environment variable on the
  processes we spawn, never a write to the host's default config dir.
- Codex account selection was for a while coupled to whether Orca's
  status-hook trust could be granted; when it could not, Orca silently
  swapped `CODEX_HOME` to its managed home and a stale credential could
  be used (#13746). Lesson: credential routing and status-hook plumbing
  are separate concerns.
- Sign-in links: Orca extracts the Codex login URL from the child
  process's stdout and shows a *Copy link / Open* notice; the notice is
  dropped when the login ends "since it dies with Codex's local callback
  server", and it is hidden in a remote account scope because it "would
  name a login running on this desktop" (#21372). Claude's `orca account
  add --json` prints the authorize URL and waits for the pasted code.
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
| Client credential | one revocable token per paired client, in `localStorage` | cookie session; short-lived attach ticket per session socket (01) |
| Host credential | none: the server *is* the trust root | runner key pair bound to the host row; pairing token minted by a signed-in user (08, 09) |
| Hosted account | optional, only for Orca Relay (mobile) and artifact publishing | required; it is the product |
| Agent login | once per host, on the host; `orca account add` headless; *Add account* disabled in remote scope | once per host, in the session terminal; link becomes a button, code gets a paste box |
| Sharing logins across hosts | none, by design and by docs | none, by design and by terms (F23) |
| Several accounts on one host | managed runtime homes + `CLAUDE_CONFIG_DIR` / `CODEX_HOME`; once wrote into the default dir by mistake | note 06, later slice; env var on the spawned process only |
| Where usage/login state is read | on the host that owns the account (after several bugs where it was not) | on the host, in the runner's heartbeat, labelled with the host |

## Sources

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
