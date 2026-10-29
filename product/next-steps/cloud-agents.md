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

## Files for a cloud session (2026-10-29)

Until now a Claude Code cloud session took a task and one repository and
nothing else: a first task's files are saved on the host, which only starts
the session, so the console dropped them. The owner asked for images to
reach the cloud's agent through a link to storage. What was built:

- **Kept in storage, not on the host.** A create with `cloud: true` may
  name `attachmentIds` like any other. Its uploads are not parked for the
  runner; the API keeps them in the deployment's storage (S3 in production)
  under `cloud-files/<workspace>/<session>/<id>`, and `prompt.first` records
  their ids as it records a host session's.
- **Linked in the task.** `claude --cloud` takes a task and nothing else, so
  the task carries the files: the text as typed, then one line per file the
  agent can run as it stands,
  `curl -fsSL --create-dirs -o /tmp/attachments/1.png '<link>'`, and
  "open each with the Read tool", which shows Claude an image or a PDF.
- **The link is the API's, not the bucket's.** A presigned S3 URL is often
  600 to 1,500 characters, and a first task is capped at 2 KB on the wire, so
  the link is `<CONTROL_PLANE_URL>/api/v1/cloud-files/<token>` (about 80
  characters), served by the API from storage with no credential. The token
  is a random UUID, lives a day in the cache, and is minted afresh on every
  launch, so a create sent again after a reconnect never names an expired
  one. It also means the cloud environment only has to allow one more host,
  the API's, whichever storage driver the deployment uses.
- **Measured before anything is kept.** The task and the longest links its
  files could get must fit 2 KB together; past that the create is refused
  with `SESSIONS_040` before a row is written or a file kept. An expired or
  unknown link is `SESSIONS_041`.
- **What the person sets up.** The Claude Code cloud environment's network
  policy must allow the API's host (Network access → Allowed domains, or a
  broader level), or `curl` fails and the agent never sees the file. Files
  stay in the bucket after their links expire; a lifecycle rule on the
  `cloud-files/` prefix (a week, say) is what removes them.

Only the first task carries files: what follows is typed on claude.ai, where
files are attached natively. Cursor's launch still takes none.

## Tasks and automations (2026-10-29)

The owner asked for both kinds of cloud session in Plan's tasks and in the
automations, not only in New session. A task's Start session and an
automation's runs now pick **where** as New session does:

- **The three places.** *On a host* (a worktree, as before), *Claude Code
  cloud* (started from a host's runner, Claude Code only) and *Cursor*
  (launched at Cursor on the person's own key, no host). One vocabulary,
  `AUTOMATION_PLACES` (`host`, `claude-cloud`, `cursor`), names them for
  both; a vendor's place is its provider id, so the next vendor is a value
  there too.
- **The table.** `AUTOMATION_PLACE_RULES` says, per place, what its host
  does (`runs` the session, only `starts` it, or none) and which agent it
  runs (one, or any a host can). The API's checks, a run's guards and
  launch, and the console's chips all read that row, so a new place is a
  row, not a branch in each of them.
- **A task.** As New session has two doors, so does a task:
  `POST /tasks/{id}/sessions` takes New session's body (Claude Code's cloud
  is that body with `cloud: true`), and `POST /tasks/{id}/sessions/cloud`
  takes `POST /sessions/cloud`'s under `cloud`. Each dispatches the command
  New session would; the session is linked to the task as `started` either
  way. The dialog's Where chip offers Cursor once the
  reader has a key, hides the host for it, and offers Claude Code alone in
  Claude Code's cloud. A cloud session starts on a task, so Start waits for
  one.
- **An automation.** The place is part of what a run executes, so it is a
  column of the revision (`automation_revision.place`, default `host`), and
  changing it is the next revision. A vendor's revision names no host
  (`CHK_automation_revision_place_host`). The editor's Runs on card leads
  with **Runs in**; Started from is the host for Claude Code's cloud, and
  Cursor has no host or agent row, its models being Cursor's.
- **Which Claude account.** A Claude Code cloud session runs on the
  claude.ai account the starting host's `claude` is signed in as (24 §7), so
  picking the host picks the account. The owner asked to see it as they
  pick: in Claude Code cloud, the task dialog's host list names each host's
  account and a line under the chips says which one the session runs on,
  and the automation editor's *Started from* names it beside the host. A
  host online whose runner cannot start a cloud session is shown, off;
  an offline one stays pickable, as the session waits for it.
- **A run.** A host place starts the session as before. Claude Code's cloud
  is a `CreateSessionCommand` with `cloud: true` from the revision's host;
  Cursor a `StartCloudSessionCommand` as the owner, on the owner's key.
  Neither holds a place on a host, so only the automation's own overlap
  holds a run back: the host's capacity and disk guards are a host place's,
  and a live cloud run does not count against the host that started it.
- **A refusal.** No key for the vendor, or a key it refused
  (`CLOUD_AGENTS_004`, `005`), pauses the automation as
  `cloud_key_missing` rather than failing every run; a launch the vendor
  refused (`010`) is skipped; a vendor that did not answer is retried. A
  host whose runner cannot start Claude Code's cloud (`SESSIONS_037`) skips
  the run as `agent_unavailable`.
- **Not done.** The run limit stops a run's session; a cloud session cannot
  be stopped from here, so a cloud run past the limit is left to finish at
  the vendor (the sweep logs it). A Cursor run's state is synced when its
  session is read, as any Cursor session's.

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
