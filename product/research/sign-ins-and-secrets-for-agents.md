# Sign-ins and secrets for agents: what Grok Bot does, what we could build

Asked 2026-11-24: "I want that they can enter like logging with Google or
can access 1Password or whatever", and how Grok Bot does it. This note
reads Grok Bot's answer from source and maps each piece onto our hosts,
sessions and bots. It decides nothing (see `README.md`).

**Source.** `b-nnett/grok-bot-0.18-reconstructed` at `a9f633e`
(2026-08-23), the same unofficial reconstruction
`lessons-from-grok-bot.md` reads. Ideas are taken from its architecture
and no code. Paths below are under its `source/`. A claim marked
*inferred* is not shown by the code in that repository: either the code
that would show it was not reconstructed, or we drew the conclusion
ourselves.

## 1. The short answer

Grok Bot's agent never handles a password and never sees a key in its
conversation. It gets each kind of access a different way:

| Need | Grok Bot's answer | Who holds the credential |
|---|---|---|
| A website login (Google, GitHub, a bank) | **Hand the computer over.** The person signs in on the box's own browser over VNC; the profile is saved and restored, so it is a one-time step | the box's Chrome profile |
| A CLI login (`gh auth login`) | The agent starts the flow and hands the box over for the part a person must do | the CLI, on the box |
| A connector (an MCP server with OAuth) | A **connect card**; the desktop opens the browser and catches the callback, and the backend stores the token and makes the tool calls | xAI's backend |
| An API key the agent needs | A **`secret-request` card**: the person types it into a form, the value goes to a file the agent cannot read, and the agent learns only that it was provided | the host |
| Keys the person sets up front | **Box secrets** in Settings, stored encrypted on the Mac and set as environment variables in the agent's shell | the Mac, then the box's environment |
| A passkey or security key | The box's Chrome forwards the WebAuthn ceremony to the desktop, which asks for approval, a touch and a PIN | the person's hardware key |
| 1Password | **Not shipped.** A dev-only prototype mints a read-only, expiring service account for a single vault | 1Password |

The prompt rule that holds it together, verbatim
(`host/runner/tools/send-message-tool.ts:17`): "NEVER ask the user to
paste a token, key, or password into the chat; always request it this way
so it stays out of the transcript and out of your context. You only learn
that they provided it."

## 2. Website sign-ins: hand the computer over

- **The tool.** `request_box_help(instruction, reason, domain, idp_domain)`,
  where `reason` is `auth | captcha | payment | other`
  (`host/runner/tools/box-help-tool.ts:6-22,75-115`). Its description:
  "Use this instead of asking for credentials: the user signs in
  themselves on the box and you never see their password or 2FA." It ends
  the turn. A second request while one is open is refused with "Do not ask
  again".
- **The card.** It has three buttons: *Take over*, *I'm done* and *Skip*. A
  full-screen VNC view carries the banner "I'm done, continue" / "Skip this
  step" (`frontend/src/recovered/features/computer/shell/view.tsx`).
- **The resume.** Handing back sends a hidden prompt to the agent, and its
  wording depends on how the person handed back
  (`host/extensions/transcript/box-handoff-resume.ts:90-127`):
  - **I'm done:** "start with the read-only Screenshot tool".
  - **Skip:** "Treat it as declined… do not immediately request the box
    again for the same step".
  - **Closed the viewer:** take a screenshot to check, and ask if it is
    still unclear.
- **The login persists.** The box's Chrome profile is snapshotted 5 s
  after its session databases change, then restored first on a new box
  (`host/extensions/box-store-sync/chrome-session-stage.ts:10-25`,
  `box-copy-in.ts:649-665`). What is saved:
  - `Cookies`, `Login Data` and `Web Data`;
  - Local Storage, Session Storage, IndexedDB and the service workers.
- **Nothing is copied from the person's own Chrome.** No code in the
  reconstruction reads or decrypts the Mac's Chrome profile.
  `lessons-from-grok-bot.md` reports a retired, agent-prompted cookie sync
  in a later version, with only a manual import left. Either way, the login
  is the person's act.
- **The rules, in prompt and code:**
  - The prompt forbids "scraping session cookies or tokens, reading a
    credential, private key, or token file to authenticate or mint your
    own access, driving a signed-in browser session by hand"
    (`host/runner/system-prompt.ts:61`).
  - The browser driver blocks the CDP method families `Storage.`,
    `Security.` and `Input.`, and every cookie read or write
    (`sand-browser-driver-source.ts:771-799`).
  - Password fields read as `"<redacted>"` (`:453-454`).
  - Subagents cannot hand the box over at all.

## 3. Connectors: OAuth with a card

- `AuthenticateMcpServer(server_id, force_reauth?, account_label?)`
  (`host/runner/tools/sand-mcp-management-tools.ts:404-414`). It shows a
  *connect* card and ends the turn. A tool call that fails because the
  server needs a sign-in shows the same card on its own
  (`host/runner/turn-agent-composition.ts:1258-1267`). The prompt says
  never to fall back to the browser for it.
- **The flow:**
  1. The box asks the backend for a sign-in URL, with the redirect
     `http://localhost:8787/callback`.
  2. The desktop opens that URL in the person's browser and listens on the
     loopback.
  3. The callback's code goes from the desktop to the backend, which
     stores the token for each server URL and account. The box never sees
     the code.
  4. The box polls for valid tokens every 5 s, for up to 15 min.
  5. When they arrive, the box restarts its MCP servers and resumes the
     agent with "[The "…" MCP server finished authorizing …]"
     (`shared/node/mcp/mcp-oauth-loopback.ts`, `mcp-auth-watch-lifecycle.ts`,
     `host/mcp-auth/host-mcp-auth-completion.ts`).
- **The backend makes the tool calls** (`executeSandMcpTool`), so neither
  the box nor the desktop holds an MCP token. There is no refresh code on
  the client; that the backend refreshes is *inferred*.
- **Every failure has a name:**
  - Refusals: `not_configured`, `admin_blocked`, `stdio_unsupported`,
    `invalid_auth_url`, `no_auth_link`, `unreachable`.
  - Callback failures: `provider_error`, `missing_code`,
    `completion_rejected`, `completion_timeout`.
  - Abandoned: a timeout or a cancel.
- **A dead path.** A coordinator forwarder that would relay a loopback
  callback to the box exists, but nothing emits the event it waits for,
  and the host's handler does nothing (`host/host-gateway-api.ts:658`).

## 4. Keys: a form card and box secrets

- **`secret-request`.** `SendMessage{type: "secret-request", secret:
  {label, description?, connector, field}}`
  (`host/runner/tools/send-message-schema.ts:46-51`). It ends the turn.
  - The form's value goes straight from the card to the host, which writes
    it to `connector-secrets/<agentId>/<platform>.json`
    (`host/extensions/transcript/widget-responses.ts:355-405`).
  - The entry is marked `secretProvided`, which also refuses a second
    submission.
  - The agent resumes with "…you never see the value and it is not in this
    conversation".
  - Two weak points: the file is plaintext with no file mode set, and the
    only target is a channel credential.
- **Box secrets.** A Settings list of environment variables, stored on the
  Mac with Electron `safeStorage` in a file with mode 0600
  (`electron-main/secrets/user-secrets-store.ts`).
  - Limits: 100 keys, 32 KB per value, 96 KB in all. Reserved names are
    refused: `PATH`, `HOME`, and the prefixes `SAND_` and `LD_`
    (`shared/box-secrets.ts`).
  - Every change pushes the whole set to the box with `replace: true`. The
    values become the shell's environment, so the agent reads `$NAME`.
  - Alongside the values goes `CLOUD_AGENT_INJECTED_SECRET_NAMES`, the
    list of names, for redaction. Nothing in the reconstruction reads that
    list, so that the box masks those values is *inferred*.
  - No prompt line tells the agent which names exist.

## 5. 1Password: a prototype, and a good shape

The bridge is reachable only from Dev Controls, and its production sink
throws "1Password provisioning is unavailable until a credential consumer
is configured" (`electron-main/onepassword/onepassword-provisioning-bridge.ts`).
The shape is still worth copying:

- The Mac runs the person's own `op`, codesign-checked. Any `OP_*`
  variables are dropped, with `OP_CACHE=false` and biometric unlock on.
  The person approves in the 1Password app.
- The person picks an account, then a vault named **"Shared with Sand"** is
  found or created.
- `op service-account create … --vault <id>:read_items --expires-in <N>s`
  mints a token that can only **read** that **one vault**, for a set time
  (60 s to a year).
- The token is handed to a sink that returns only a reference, never the
  value.

How the box would have used it (as `OP_SERVICE_ACCOUNT_TOKEN`, or `op`
inside the box) is not in the source.

## 6. Mapped onto Oppenheimer

Our position differs from Grok Bot's in ways that matter:

- **A host is usually the person's own machine.** Grok Bot's box is a
  cloud computer. On a Mac the agent already shares the person's `gh`,
  `gcloud` and browser logins, so the "sign in once on the box" problem
  only really bites on a headless host or a VM.
- **We already broker one credential.** The runner's git credential helper
  (`versions/mvp/02-runner.md` §8) asks the runner over its 0600 socket
  for a one-hour, per-session token. The token lives in memory, is never
  written to disk, and is pulled before it expires. This is the pattern to
  generalise.
- **The host desktop already reaches the browser.** `runner desktop on` and
  the relay's VNC (`device-streaming.md`) are the takeover Grok Bot builds
  on.
- **Bots run in the control plane.** For a bot's connectors, the API sits
  where Grok Bot's backend does, and it is public, so no loopback is
  needed.
- **F23 is untouched.** Nothing here reads or moves a Claude or Codex
  subscription login (`orca-web-auth-and-cross-host-logins.md` §5).

What we could build, in order of value for cost:

| # | Build | From | Lands in |
|---|---|---|---|
| 1 | **`request_secret` for sessions and bots.** An agent names the variable, the host it is for and why, and the turn waits. The Inbox and the session show a form, and Slack, Telegram and WhatsApp carry only a link to it. The browser encrypts the value to the host; the runner keeps it, owner-only, and serves it through the session's environment or the credential socket. The agent hears "provided" or "declined". A bot's key is kept beside its model-provider keys in the API | §4 `secret-request` | `02-runner.md` §8, `25-bots.md` §3.2, `29-inbox.md` |
| 2 | **Project secrets.** In project or host settings, names and values entered through the same form. Every new session's tmux starts with them set, which also fixes worktrees starting without the untracked `.env`. Reserved names and limits as in §4, and the console shows names only | §4 box secrets | `14-hosts-settings.md`, `02-runner.md` |
| 3 | **Redact what we know.** The runner knows each injected value, so session reads, share links and bot pages can drop the exact value. That is stronger than redaction by shape (`next-steps/agent-tools.md`) | §4 `…_SECRET_NAMES` | `next-steps/agent-tools.md` |
| 4 | **Hand the host over.** A `request_host_help` card ("Sign in to Google on the host's browser") with Take over, I'm done and Skip. It opens the host desktop we already relay, and the hand-back resumes the turn with Grok Bot's three wordings. Sessions get it through `apps/mcp`; bots get it as the resume point `25-bots.md` §3.2 lists as not built. For a terminal login such as `gh auth login`'s device code, the session's own terminal is the takeover | §2 | `25-bots.md` §3.2, `device-streaming.md` |
| 5 | **OAuth for connectors, "Sign in with Google".** For bots, the API holds the token, refreshes it and makes the calls, with the callback on the API's own HTTPS URL. For a session's CLI on a remote host, the hard part is the CLI's own `localhost` callback. The console would open the sign-in URL in the person's browser, catch the redirect, and relay `{code, state}` over the link to the runner, which replays it on the host's loopback port (Grok Bot's unfinished forwarder, finished) | §3 | `25-bots.md`, `02-runner.md` |
| 6 | **1Password.** The person runs a one-time `runner secrets 1password` on the host. With their `op` and biometric approval, it mints a read-only service account for one vault ("Shared with Oppenheimer") with an expiry. The token stays on the host, and the agent reads only that vault's items. Better still, the runner resolves `op://` references into the session's environment, so the agent never holds the token | §5 | `02-runner.md` |
| 7 | **Passkeys.** Skip for now. On a Mac host the person's key is already at hand; this matters only for headless hosts and VMs | §3 WebAuthn | — |

Each row would also add the prompt rules: never ask for a key or password
in chat, never scrape cookies or token files, and hand over instead.

**What we leave:**

- **Copying cookies from the person's own browser.** Grok Bot ships none,
  and our cross-host logins note reached the same answer: moving a sign-in
  is the person's act.
- **Plaintext secret files with no mode set.**
- **Pushing the whole environment with `replace`.** In the reconstructed
  daemon this drops `PATH` (*inferred*, and possibly a stand-in for the
  real daemon).
- **The egress tunnel.** It sends the box's traffic out through the
  desktop; our hosts already are the person's network.

## 7. Open questions

1. **How the browser encrypts to a host.** A host's key is Ed25519, which
   signs and cannot encrypt (`versions/mvp/31-peer-to-peer-and-the-host-proof.md`).
   Rows 1 and 2 need an X25519 key: either derived from the Ed25519 key,
   or a second key published with the host proof.
2. **Whether the API keeps ciphertext.** If it does, a host that is
   reinstalled can get its secrets back. If it does not, nothing of value
   ever leaves the host, but a new host means typing them in again.
3. **An environment variable or a broker.** With an environment variable,
   the agent can `echo` the value; through the credential socket, a tool
   must ask for it. Grok Bot uses environment variables. Rows 1 and 2
   could start there and move to a broker per name later.
4. **Which 1Password plans have service accounts.** Check before row 6.
