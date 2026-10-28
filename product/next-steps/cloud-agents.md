# Cloud agents

**Goal:** start and follow sessions that run in the vendors' clouds
(Claude Code's `claude --cloud`, Codex cloud, Cursor's Cloud Agents) from
the console, next to sessions on hosts. A session can also be brought
back onto a host as an ordinary terminal session. The owner raised this
on 2026-10-22, and it has no version yet.

**Claude is built** (2026-10-27), ahead of the order below, because the
owner asked for it end to end:

- **Cloud is a third place** (`../versions/mvp/24-session-places.md` §7). New
  session's Where chip offers *Claude Code cloud* on a host.
- **The dispatching host's runner starts it.** It fetches the repository with
  a token sealed into the create, runs `claude --cloud <task>` in a scratch
  checkout of the base (the CLI insists on a terminal, so it gets a
  pseudo-terminal), reports the cloud session's id on `session.started` and
  removes the checkout. Nothing is left on the host and nothing is polled.
- **Status comes from the browser.** `apps/extension` reads the person's
  cloud sessions on claude.ai with the sign-in already in their Chrome, and,
  once connected with a personal token pinned to the workspace, posts what it
  sees to `POST /sessions/cloud-status`. The API keeps it for the sessions the
  workspace launched, as the agent's observed state, so their dots follow the
  usual rules. No claude.ai credential ever leaves the browser.
- **Bring it here** is the command, `claude --teleport <id>`, on the
  session's pane. A Teleport button that opens a worktree session on a host
  is not built.

The proposal is [`../research/cloud-agents.md`](../research/cloud-agents.md)
§5, and its open questions are §6. This file keeps only what decides
whether it lands, and in which version. In short, the remote features for
host sessions come first, then a Cloud place: Cursor first, then Claude,
then Codex.

## What landed (2026-10-26)

The owner asked for Cursor's cloud first, end to end and thin, ahead of a
version: a rail item, **Cloud agents**, beside Sessions. The next day it
moved into Sessions (below); the rail item, its own table and its pages are
gone, and "What it is" and "What it shows" here are kept as history.

- **Who calls the vendor.** The control plane, on the person's own Cursor
  API key (Settings → Cloud agents). The key is checked with Cursor
  (`GET /v1/me`) before it is stored, sealed under `CLOUD_AGENTS_KEY`, one
  per person, workspace and vendor, never returned and never sent to a
  host. It bills the person's own Cursor plan. Grok runs here as one of
  Cursor's models (Cursor lists `grok-4.7`); xAI's own API has no cloud
  agent to launch.
- **What it is.** Its own module and table (`apps/api/src/cloud-agents/`,
  `cloud_agent`), not a third place of `work_session`: a work session is
  the fold of a host's event log, with a host, a tmux session and
  checkouts, none of which a vendor's agent has. Note 24 stays as it is.
  A cloud agent is a person's own: nobody else in the workspace reads it.
- **What it shows.** Launch (a prompt, a repository Cursor can reach, a
  model or Cursor's own pick, a starting branch, open a pull request);
  the run's status, pushed branch, pull request and last reply; Stop; a
  next instruction as a new run; Open in Cursor. No chat stream yet: the
  run is read (`GET /v1/agents/{id}/runs/{runId}`), not streamed.
- **Only what we launched** is listed; agents started from Cursor's web
  page, Slack or Linear are not imported.
- **The budget.** Cursor counts about 20 calls a minute per person. An
  open agent is read at most once in ten seconds, a list asks about at
  most three working agents once in thirty, models are cached an hour and
  repositories ten minutes (Cursor allows one listing a minute). Every
  call goes through one `UpstreamLimiter` bucketed by the Cursor user; a
  rate limit is `CLOUD_AGENTS_007`, and a read never fails on it.
- **The provider shape.** `CloudAgentProvider` with Cursor the one
  provider in its registry. The person picks the vendor, so there is no
  fallback walk: an agent lives at the vendor it was launched on.

What the first real call proved, on the owner's key (2026-10-26): the key
is accepted and names its account, models and repositories list, a wrong
key is `CLOUD_AGENTS_005` in Cursor's words. A launch reached Cursor and
was refused for the account's prepaid balance (`usage_limit_exceeded`,
shown as `CLOUD_AGENTS_010` with Cursor's sentence), so a run on Cursor's
side is proven against the stub only (`e2e/support/cursor-stub.ts`).

## Cloud sessions are sessions (2026-10-27)

The owner asked for cloud sessions where the other sessions are, chosen in
New session's picker (`design/` exports: the place chip's **Cloud**
section, the engine button's vendor tab). Asked to choose the storage, they
left it to us and asked for the long-term decision; the row was to link out
to Cursor.

- **The model.** A cloud session Cursor runs is a `work_session` with place
  `cloud` and no host (`CHK_work_session_cloud_host`). Its vendor half is one row of
  `session_cloud_run` (provider, the vendor's agent and run ids, its
  status, URL, branch and pull request), and what the vendor reports is
  folded into the session's own log with idempotency keys
  `cloud:<runId>:<fact>`: running is started and working, finished is
  done, failed and expired are failed, cancelled is stopped. So the
  sidebar's groups, the Inbox and every reader of a session read a cloud
  session with no branch of their own. One more vendor is a provider and
  its id, never a table.
- **Why not its own table.** A second list beside sessions is a second
  sidebar, a second set of groups and a second answer to "what needs
  me"; folding the vendor into the session costs a nullable host and a
  refusal. Every command only a host session has (a terminal, a checkout,
  a restart, a share, an answer) refuses a cloud session with
  `SESSIONS_039` before anything is sent; closing one closes it here only.
- **Launch.** `POST /v1/sessions/cloud`: the vendor is asked first on the
  launcher's sealed key, then the session is created with its run and the
  first events in one transaction, then named as any session is. Cursor
  is not asked to open a pull request (`autoCreatePR: false`).
- **The read.** Finding a session or a page of them syncs the cloud ones
  that need it on the launcher's key, within the budget above (one in ten
  seconds open, three in thirty in a list). The console polls a working
  cloud session every five seconds (`cloudSession`); the event stream does
  not cover it.
- **The console.** The place chip's **Cloud** section lists Cursor, or
  Connect when the person has no key. Picking it puts Cursor's models in
  the engine button (Auto is Cursor's own pick) and hides the permission
  chip; files cannot be attached. Send opens Cursor in a tab and goes to
  the session. The session's row carries Cursor's mark and opens Cursor;
  its page says the run's state and links there.
- **Settings → Cloud agents** stays where the key is stored.

## Two kinds of cloud session (2026-10-28)

Claude's cloud (above, built on `main`) and Cursor's (this branch) landed
the same day as two readings of the one `cloud` place: Claude's with a host
that starts it, Cursor's with none. The owner asked for both, with Grok's
after them. They are two kinds of the one place, not two places:

- **Who starts it.** Claude Code's cloud is started by a host's runner
  (`claude --cloud`), so its session names that host and is created by
  `POST /sessions` with `cloud: true`. A vendor the control plane reaches
  through an API (Cursor's) is launched by `POST /sessions/cloud` and has
  no host: `hostId` is null, which `CHK_work_session_cloud_host` allows for
  `cloud` alone.
- **Who follows it.** Claude's state comes from the browser extension
  (`POST /sessions/cloud-status`); a launched vendor's from its own API,
  synced on read into the same log.
- **What each refuses.** Neither has a terminal. A Claude Code cloud
  session refuses input with `SESSIONS_038` (answer it on claude.ai);
  anything only a session a host started has (terminal, checkout, restart,
  share, prompt) refuses a launched vendor's with `SESSIONS_039`.
- **In the console.** *Claude Code cloud* is a place in a host's Start in
  pane, with a cloud mark on its row and a pane with Open in claude.ai and
  the teleport command. A launched vendor is the place chip's **Cloud**
  section, with the vendor's mark on its row, which opens the vendor. The
  draft tells them apart by `cloudProvider`: set for a launched vendor,
  null for every place a host runs or starts.
- **Grok next.** It is a provider of whichever kind xAI offers: the
  launched kind if it publishes an agent API (a provider and its id, as
  Cursor), the host-started kind if its CLI gets a cloud mode (a runner
  adapter, as Claude). Until then Grok runs as one of Cursor's models.

## Questions to answer first

1. ~~Does the control plane holding a person's Cursor API key need F23
   reworded to "no subscription sign-in"?~~ Answered 2026-10-26: F23
   carries a dated line saying so (`../04-security-review.md`).
2. Which version takes it, and does the first step (remote features for
   host sessions) go into 0.7 with the chat? Cursor and Claude landed
   ahead of any version; Codex and Grok still wait on this.
3. ~~Do cloud sessions started elsewhere show up in our list?~~ Answered
   2026-10-26: only the ones we launched.
4. ~~Does Cloud as a third place hold?~~ Answered 2026-10-26 for now: a
   session with no terminal has a model of its own (`cloud_agent`).
   **Reversed 2026-10-27**: it holds, as `research/cloud-agents.md` §5
   proposed. A cloud session is a `work_session` in place `cloud` (see
   "Cloud sessions are sessions"), so Claude `--cloud`, Codex cloud and
   Grok's are each a provider of the same place, not a module each (see
   "Two kinds of cloud session").
5. A chat for a cloud agent: Cursor streams a run (`…/runs/{runId}/stream`,
   SSE) in shapes close to the 0.7 chat's entries. Does the console stream
   it through the API, and does the run's transcript get kept?
6. "Bring it here": a worktree session on a host, on the agent's
   `cursor/…` branch. It needs the agent's repository to be one of the
   workspace's projects.
