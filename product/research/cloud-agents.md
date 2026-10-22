# Cloud agents: Claude Code, Codex and Cursor

Read on 2026-10-22, for the owner's idea of running sessions in the
vendors' clouds beside sessions on hosts: Claude Code's cloud sessions
(`claude --cloud`), Codex cloud, and Cursor's Cloud Agents. It also
covers the remote features each vendor ships for its local CLI, because
some of them change how we run Codex and Claude Code on hosts too.
This note decides nothing; the proposal in §5 is what
`next-steps/cloud-agents.md` starts from.

Sources are the vendors' docs as served on 2026-10-22, plus the
`openai/codex` source at `9a8a85b`. OpenAI's Codex docs moved from
`developers.openai.com/codex/*` to `learn.chatgpt.com/docs/*` (a 308
redirect). Every vendor surface below that says beta or experimental is
marked so; expect them to move.

## 1. The short answer

| | Claude Code cloud | Codex cloud | Cursor Cloud Agents |
|---|---|---|---|
| Where it runs | A VM per session (Ubuntu 24.04, 4 vCPU, 16 GB), from a saved environment | A VM per task (4 vCPU, 16 GiB on Pro and up), from a published environment | An Ubuntu VM per agent on Cursor's AWS, from a saved environment or `.cursor/environment.json` |
| Billed to | The claude.ai plan's usage | The ChatGPT plan's limits, shared with local Codex | The Cursor plan's usage at the model's rate; usage-based pricing on |
| Public API | **No**, except firing one saved scheduled task | **No**; the CLI calls ChatGPT's private `backend-api/wham/*` | **Yes**: `api.cursor.com` v1 (public beta) |
| Credential | claude.ai sign-in; the terms forbid a third party holding it | ChatGPT sign-in; API keys do not reach cloud | A user API key, sent as Bearer |
| Start one from a host | `claude --cloud "task"` | `codex cloud exec --env <id> [--branch] [--attempts 1-4] "task"` | `agent` CLI: `&` prefix in the TUI (headless equivalent unconfirmed), or the API |
| List | Nothing outside claude.ai | `codex cloud list --json`, `status`, `diff` | `GET /v1/agents` (includes Slack, Linear, GitHub and web launches) |
| Follow live | Nothing outside claude.ai | Nothing documented; poll `status` | SSE per run, resumable with `Last-Event-ID` |
| Send a follow-up | `claude -p "msg" --cloud <id>` (queues and exits) | In ChatGPT only (no CLI route found) | `POST /v1/agents/{id}/runs` (`409 agent_busy` while one runs) |
| Events | None for outsiders | None | v0 webhooks only (`statusChange`, HMAC-SHA256); v1 says "coming soon" |
| Bring the work local | `claude --teleport <id>`: branch and history into the terminal | `codex apply <task>`: the diff, `git apply` | Check out the pushed `cursor/…` branch; the desktop app can hand off |
| Result lands as | A pushed branch (`claude/…`); the PR is made from the diff view | A diff in ChatGPT; a PR on request | A pushed branch (`cursor/…`), optionally a PR (`autoCreatePR`) |

Only Cursor gives us an API that a control plane can call. Claude Code and
Codex can be driven only through their own CLIs, signed in on the host.
That fits the runner model we already have.

## 2. Claude Code

### Cloud sessions

- **Runtime.** Each session is a fresh VM: Ubuntu 24.04 x86_64, 4 vCPU,
  16 GB RAM and 30 GB disk, counted against the plan.
  - Plans: Pro, Max and Team, plus Enterprise premium seats.
  - Organisations with ZDR, HIPAA or CMEK are excluded.
  - An **environment** holds:
    - a network level (None, Trusted, Full or Custom);
    - environment variables and network secrets;
    - a root setup script, snapshot-cached if it finishes in about 5 minutes.
  - SessionStart hooks run in every session. `CLAUDE_CODE_REMOTE=true` and
    `CLAUDE_CODE_REMOTE_SESSION_ID` tell a script where it is.
  - Source: <https://code.claude.com/docs/en/cloud-environments>.
- **GitHub.** Access goes through the Claude GitHub App or `/web-setup`.
  Credentials stay out of the VM, because a proxy adds them. With no
  GitHub access, the CLI uploads a git bundle under 100 MB and the
  session cannot push.
- **Lifecycle.** An idle VM pauses and is later reclaimed. Reopening a
  session restores the conversation but not the processes. Sessions
  archive and delete.
  Source: <https://code.claude.com/docs/en/claude-code-on-the-web>.
- **CLI.**
  - `claude --cloud "task"` starts a session from the current repository's
    GitHub remote at the current branch. `--remote` is a deprecated alias.
  - `claude -p "msg" --cloud <id|url> --output-format json` queues a message
    into a session and returns `{ok, session_id, url}`.
  - `claude --teleport [id]` pulls a cloud session's branch and conversation
    into the terminal. It needs a clean tree, the same repository, the
    branch pushed and the same account. It only goes one way: the CLI
    cannot push a local session up, and only the desktop app can.
  - `/remote-env` picks the default environment.
- **Self-hosted environments** are in public beta for Team and Enterprise.
  The organisation runs runners that poll `api.anthropic.com`, claim
  sessions and run `claude` on its own machines. The control plane and
  the UI stay claude.ai's. This is our shape, run by the vendor.
  Source: <https://code.claude.com/docs/en/self-hosted-environments>.

### What a third party may do

- **No public API creates, lists, follows or archives a person's
  claude.ai cloud sessions.**
- The one HTTP route is the scheduled-task fire API:
  - The call is `POST https://api.anthropic.com/v1/claude_code/routines/{trig_id}/fire`,
    with a per-task token made in the claude.ai UI.
  - It returns a session id and URL.
  - It is experimental, allows 30 fires per hour per task, and gives no
    read access.
  - Source: <https://platform.claude.com/docs/en/api/claude-code/routines-fire>.
- **The terms rule out the rest.**
  - Quoted: "may not collect, store, or intermediate Claude.ai credentials
    or session tokens".
  - Products that host Claude Code must run the unmodified binary, signed
    in by each person.
  - Source: <https://code.claude.com/docs/en/legal-and-compliance>.
  - This is note 01 §7 and F23 again. The only legitimate driver of
    `--cloud` and `--teleport` is the person's own CLI on the person's own
    machine, which is our runner's position exactly.
- **Managed Agents** (`/v1/sessions`, SSE, webhooks) is a real API, but it
  needs an API key and runs Anthropic's agent harness rather than Claude
  Code. It is not this feature.

### Remote Control

`claude --remote-control` (`--rc`), or `/rc` inside a session, lets
claude.ai/code and the Claude mobile app drive a session that runs
locally. It works over outbound HTTPS, needs a subscription, and Team or
Enterprise admins have to switch it on.
Source: <https://code.claude.com/docs/en/remote-control>.

For us, a Claude Code session in tmux on a host could carry `--rc`. The
person would then reach the same session from the Claude app as well as
from our console, with no credential crossing us.

## 3. Codex

### Cloud tasks

- **Runtime.** Each task runs in a VM built from a published environment.
  - Codex writes an install script and a start skill for the repository
    itself.
  - Internet access is set per environment, with domain presets.
  - Network secrets are swapped in by a proxy.
  - A VM's state can be recovered for 7 days.
  - Source: <https://learn.chatgpt.com/docs/environments/cloud-environments>.
- **Starting a task.** Tasks start from ChatGPT web, mobile and desktop,
  Slack, `@codex` on GitHub, Linear, and the CLI:
  - `codex cloud exec --env ENV_ID [--attempts 1-4] [--branch B] QUERY`;
  - `codex cloud list|status|diff|apply`, plus a TUI browser.
  - `codex cloud` is labelled **[EXPERIMENTAL]** in `codex-rs/cli/src/main.rs`.
- **Results** are a diff in the task. `codex apply TASK_ID` runs `git apply`
  on it locally and fails non-zero when it does not apply. Best-of-N runs
  up to four attempts, and a sibling can be applied instead.
- **No public API.** The CLI's client calls
  `https://chatgpt.com/backend-api/wham/tasks…` with the ChatGPT bearer
  token, `ChatGPT-Account-Id` and `User-Agent: codex-cli`
  (`codex-rs/backend-client/src/client.rs`). Calling that from a hosted
  service would mean holding the person's ChatGPT tokens and posing as the
  CLI.
  - Bots already do something close to this for
    `backend-api/codex/responses` (`versions/mvp/25-bots.md` §2), on a
    workspace sign-in.
  - A private task API is a larger exposure than that. Shelling out to
    the CLI on the host is the supported shape.
- **No thread moves between local and cloud**, even in OpenAI's own app.
  A cloud task needs its branch pushed first.

### Remote and headless features for the CLI on a host

These matter more than cloud for Codex sessions on our hosts:

- **`codex app-server`** is the documented route for "deep integration
  inside your own product", and the VS Code extension runs on it. Source:
  <https://learn.chatgpt.com/docs/app-server>.
  - **Stability:** it is experimental, "not supported for production
    workloads", and versioned with the binary.
  - **Transport:** JSON-RPC over stdio, `unix://` or `ws://` (experimental).
  - **Threads and turns:** `thread/start|resume|fork|read|list|archive`,
    `turn/start|steer|interrupt`.
  - **Notifications:** item and delta notifications.
  - **Approvals:** server-to-client requests
    (`item/commandExecution/requestApproval`,
    `item/fileChange/requestApproval`).
  - **Login and limits:** `account/login/start` (including
    `chatgptDeviceCode`) and `account/rateLimits/read`.
  - **Types:** `codex app-server generate-ts` writes the types for the
    installed version.
- **`codex --remote unix://…`** attaches the TUI to an app-server that is
  already running. A runner-owned app-server per Codex session could then
  serve both the TUI in tmux and a typed event stream to the console, from
  one thread. The 0.7 chat would get deltas and approvals as UI without
  giving up the terminal or process survival
  (`research/lessons-from-synara-and-openclaw.md` §1 and its open
  question 1).
- **`codex remote-control start|pair`** (experimental) and the desktop
  app's remote connections relay a host's app-server to ChatGPT mobile
  through an outbound enrollment. This is the same idea as Claude's
  `--rc`: the person's phone reaches the session by the vendor's path,
  not ours. The desktop app can also attach to an SSH host and start its
  app-server there.
  Source: <https://learn.chatgpt.com/docs/remote-connections>.
- **`codex exec --json`** (with `resume` and `fork`) and the TypeScript SDK
  (which wraps `exec --experimental-json`) are the headless path for
  automations, the way `claude -p` is
  (`versions/mvp/16-automations-architecture.md`).
- **Hooks** (`features.hooks`) cover SessionStart, PreToolUse,
  PermissionRequest, Stop and SessionEnd, among others. They have to be
  trusted by hash. They are the authoritative state signal that 02 §9
  prefers over reading the screen, and Codex's manifest is still
  provisional there. Source: <https://learn.chatgpt.com/docs/hooks>.
- **Rollouts.** These live under `$CODEX_HOME/sessions/…/rollout-<ts>-<uuid>.jsonl`,
  and the format is migrating toward paginated history and an optional
  SQLite store. That is the transcript a Codex reader in
  `sessions/adapters/transcript` would follow: for `prompt.first`, and for
  the chat, which is 0.7's item 4.
- **Removed:** `codex mcp-server` and `codex proto`.

### Accounts

- **ChatGPT sign-in vs API key.** A ChatGPT sign-in draws on plan limits:
  5-hour windows plus a weekly cap, with local and cloud sharing one
  allowance. An API key bills at API rates, and cloud, GitHub review and
  Slack need ChatGPT.
- **Headless login.** Either:
  - `codex login --device-auth`, which a workspace admin must enable; or
  - copying `auth.json`, which the docs sanction for a person's own
    machines.

  `research/orca-web-auth-and-cross-host-logins.md` §3 already covers
  both.

## 4. Cursor

- **Runtime.** An Ubuntu VM per agent, on AWS.
  - The environment comes from a personal or team saved environment, or
    from `.cursor/environment.json` (`install`, `start`, `terminals` in a
    shared tmux, `snapshot`, `build.dockerfile`).
  - Secrets are scoped to the team, the user or the environment.
  - Network is allow-all by default, with allowlist modes.
  - Agents auto-run every command.
  - The account must use the new Privacy Mode; the legacy mode is refused.
  - Source: <https://cursor.com/docs/cloud-agent/setup.md>.
- **API v1** (public beta), base `https://api.cursor.com`, authenticated
  by a user API key as Bearer. Source:
  <https://cursor.com/docs/cloud-agent/api/endpoints.md>.
  - **Objects.** An **agent** (`bc-<uuid>`, durable) and its **runs**
    (`run-<uuid>`, one per prompt).
  - **Launch.** `POST /v1/agents` takes `prompt{text, images}`,
    `model{id}`, `repos[{url, startingRef|prUrl}]`, `workOnCurrentBranch`,
    `autoCreatePR`, `mode: agent|plan` and `env{type: cloud|pool|machine}`.
    - A client-chosen `agentId` makes launch idempotent; a repeat gets
      `409 agent_id_conflict`.
    - v1 has no branch-name field, so the branch is read back from
      `run.git.branches`.
  - **Follow-up.** `POST /v1/agents/{id}/runs`.
  - **Cancel.** `POST …/runs/{runId}/cancel`, which is terminal for that
    run.
  - **Archive and delete:** both are on the agent.
  - **Statuses.** Agent: `ACTIVE | IDLE | ARCHIVED`. Run:
    `CREATING | RUNNING | FINISHED | ERROR | CANCELLED | EXPIRED`.
  - **Live stream.** `GET …/runs/{runId}/stream` is SSE: `status`,
    `assistant` deltas, `thinking`, `tool_call` (running or completed,
    with args and result), `result`, `error` and `done`.
    - A dropped stream resumes with `Last-Event-ID`.
    - Past the retention window it answers `410 stream_expired`; read the
      run instead.
    - These events map almost one to one onto the 0.7 chat's entries.
  - **Discovery.** `GET /v1/me` validates the key and names the user.
    `GET /v1/models` lists models. `GET /v1/repositories` is limited to
    **1 per minute and 30 per hour**, so we cache it.
  - **Rate limits.** The general default is 20 requests a minute; the
    per-endpoint numbers are unconfirmed.
  - **Webhooks are v0 only.** The one event is `statusChange` to
    `FINISHED` or `ERROR`, signed `X-Webhook-Signature: sha256=…`.
- **`agent` CLI** (formerly `cursor-agent`).
  - It installs with `curl https://cursor.com/install | bash`.
  - It is an interactive TUI with `-p --output-format stream-json`,
    `--resume` and `-w` worktrees.
  - Auth is `agent login` or `CURSOR_API_KEY`.
  - It runs in tmux like the other engines, which makes it a fifth agent
    for the launch catalog.
- **My Machines / pools.** `agent worker start` on a person's machine runs
  Cursor's agent loop with its tools executing locally, over outbound
  HTTPS only. Our runner could host such a worker, but then Cursor's
  control plane is driving our host beside ours. Not for now.

## 5. What we should do

Two kinds of thing are being asked for, and they should not be one
feature.

### A. Remote features that make host sessions better (do first)

These keep tmux, the runner and the per-host login exactly as they are:

1. **Codex parity on hosts.**
   - A Codex reader in `sessions/adapters/transcript` for `prompt.first`
     and the chat (0.7 item 4).
   - Codex hooks for state, replacing its provisional screen manifest.
2. **Codex through its app-server, behind the TUI.**
   - The runner starts `codex app-server --listen unix://<session>.sock`
     and window 0 runs `codex --remote unix://…`.
   - The runner reads the same socket for typed deltas and approvals.
   - This is a spike first. The protocol is experimental and changes per
     version, so we pin the Codex version the catalog installs and
     generate the types from it.
3. **Vendor remote control as a launch option.** A "Reachable from the
   Claude / ChatGPT app" toggle adds `--rc` for Claude Code, and
   `codex remote-control` for Codex once it leaves experimental. The
   person's phone then reaches the session through the vendor, and we
   hold nothing. It is cheap and optional, and it competes only with 0.5
   Mobile, which it does not replace.
4. **Cursor's `agent` CLI as an engine** in `CODING_AGENTS` and the
   runner's launch catalog: login on the host, as for the others.

### B. Cloud sessions: a session whose place is the vendor's cloud

A third **place** beside `worktree` and `folder`
(`versions/mvp/24-session-places.md`; the blank terminal is an agent, not
a place): **Cloud**, with a provider of Claude, Codex or Cursor. A cloud session has no PTY. It has a status, a
chat when the vendor gives one, a branch, a pull request, and a link to
the vendor's own page.

**Who calls the vendor.**

- **Claude and Codex: the runner, on a host the person picks.** That host
  is the *dispatching host*, and its own login is used.
  - **Claude.** `claude --cloud` is run from a worktree of the project's
    repository at the chosen base, after the base is pushed.
    `claude -p --cloud <id>` sends follow-ups.
  - **Codex.** `codex cloud exec --env --branch --attempts` launches, and
    `codex cloud list --json` and `status` are polled.
  - The runner reports the vendor's id and URL on the link. This is the
    only route that keeps F23 and Anthropic's terms, and it reuses
    pairing, the link and the host inventory.
  - The costs:
    - a host must be online to start one (not to keep it running);
    - Claude gives no status at all.
- **Cursor: the control plane, with the person's own API key.** This is
  the bots' model-provider key precedent (`versions/mvp/25-bots.md`):
  stored sealed, never returned, never sent to a host.
  - It is an API key the vendor documents for exactly this purpose, not
    a subscription sign-in, so F23's reasoning (one subscription, one
    person, one machine) does not apply.
  - It needs a line in F23 and in the decisions list saying so.
  - The alternative, a runner on a host making the calls, works but buys
    nothing.

**What each provider can show.**

| | Claude | Codex | Cursor |
|---|---|---|---|
| Status | "Started", then the branch's commits and PR (0.2) | Polled from `codex cloud status` | The run's status, live |
| Chat | None; a link to claude.ai/code | Diff only; a link to ChatGPT | The SSE stream into the 0.7 chat components |
| Follow-up | Yes, through the dispatching host | No (in ChatGPT) | Yes |
| Stop | No | No | Cancel the run |
| Bring it here | **Teleport**: a new worktree session whose window 0 is `claude --teleport <id>` | **Apply**: a new worktree session with `codex apply <task>` run first | **Check out**: a new worktree session on the `cursor/…` branch |

"Bring it here" is the strongest part of the idea. A cloud session ends
up as an ordinary host session with a terminal, carrying the cloud
session's history where the vendor allows it.

**Status for Claude, if we want more than a link.** We could take an
opt-in SessionStart and Stop hook in the repository that POSTs
`CLAUDE_CODE_REMOTE_SESSION_ID` to Oppenheimer with a per-project token.
Its network level must allow our host. This is an inbound event, and
`inbound-events` already exists for that. It is not in the first cut.

**Data.** Cloud extends the place model that note 24 owns. It is not a
parallel set of columns:

- `SESSION_PLACES` and `CHK_work_session_place` gain `cloud`.
- The cloud fields are the payload of that place, held to it the way
  `folderPath` is held to `folder` (`CHK_work_session_folder_path`):
  - the provider;
  - the vendor's id and URL;
  - the dispatching host (none for Cursor).
- A check makes them present exactly when `place = 'cloud'`, so a session
  can never be two places at once. The place writer that sets `folder`
  sets them too.
- Note 24 is where the place and its payload get written down, once this
  is decided.

The session's state maps onto the existing states: working, waiting on
you, done, failed. The Pull requests area (0.2) already tracks a branch to
its PR, and that is where Claude and Codex cloud sessions get their
"done".

**Order.**

1. **Cursor cloud first.**
   - Its API, stream and branch output make the whole feature visible
     end to end without running anything through a host.
   - It proves the place, the data and the chat for a session with no
     terminal.
2. **Claude `--cloud` and teleport** through the runner.
3. **Codex cloud** through the runner, last. `codex cloud` is
   experimental, and the remote features in A are worth more for Codex.

## 6. Open questions

1. Does Cursor's API key belong to the person or to the workspace?
   Workspaces are personal today, so the answer only matters once teams
   arrive. Multi-account's question 3 is the same question.
2. Is a cloud session in the sessions list beside host sessions, or in
   its own group? `GET /v1/agents` also returns agents started from
   Slack, Linear and GitHub. Do we import those, or show only what we
   launched?
3. Does the dispatching host need to be the person's, or can any online
   host in the workspace dispatch? With personal workspaces these are the
   same.
4. Does a cloud session cost anything we should meter? Every vendor bills
   the person's own plan, and nothing passes through us.
5. Do we ever take OpenAI's "Sign in with ChatGPT" partner programme
   (<https://developers.openai.com/siwc/quickstart>), which would be the
   sanctioned route to a hosted Codex? It is a limited trial for
   commercial partners.
