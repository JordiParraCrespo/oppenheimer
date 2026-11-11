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
  removes the checkout. Nothing is left on the host and nothing is polled:
  since 2026-11-05 the start stops the CLI's whole process group (not only
  `claude` itself, whose helpers survived it), forgets the checkout in
  Claude Code's own state (`~/.claude.json`, `projects/`), and deletes the
  scratch checkouts a runner stopped mid-start left behind.
- **Status comes from the browser.** `apps/extension` reads the person's
  cloud sessions on claude.ai with the sign-in already in their Chrome, and,
  once connected with a personal token pinned to the workspace, posts what it
  sees to `POST /sessions/cloud-status`. The API keeps it for the sessions the
  workspace launched, as the agent's observed state, so their dots follow the
  usual rules. No claude.ai credential ever leaves the browser.
- **Bring it here** is the command, `claude --teleport <id>`, on the
  session's pane, and, since 2026-11-03, *Continue on a host* above it: the
  reader picks a host (the one that started it while it is online, else the
  first online one), and the console starts a worktree session there on
  the cloud session's repository, from the base it started on, in its
  project and under its name, whose agent runs `claude --teleport <id>`
  instead of opening a conversation of its own, then opens that session.
  The create carries `teleport` (one checkout, no first task); the launch
  keeps it (`launchTeleport`), so a create sent again after a reconnect
  continues the same cloud session, and a restart reopens what it left with
  `claude --continue`. A runner takes it only once its hello names
  `session.teleport` (`SESSIONS_048` otherwise). The host's Claude Code must
  be signed in to the account that owns the cloud session. Claude Code names
  the teleported conversation itself, so the runner does not name one: it
  takes the newest transcript in the session's folder since the agent opened
  it as the session's conversation and keeps it, and the chat view, question
  detection and the status line read it by that name. A restart looks for it
  again, since `--continue` may name it anew.

The proposal is [`../research/cloud-agents.md`](../research/cloud-agents.md)
§5, and its open questions are §6. This file keeps only what decides
whether it lands, and in which version. In short, the remote features for
host sessions come first, then a Cloud place: Cursor first, then Claude,
then Codex.

## Codex is built (2026-10-29)

The owner asked for Codex cloud tasks "more or less as Claude Code": started
from a host, finished on OpenAI's machines, not ours, with their status
followed here and a way to bring the work back. It is the host-started kind
of the `cloud` place with the agent `codex`
(`../versions/mvp/24-session-places.md` §7):

- **The dispatching host's runner starts it** with
  `codex cloud exec --env=<environment> --branch <base> <task>` and the
  host's own ChatGPT sign-in. Codex reads the branch from GitHub, so
  nothing is fetched or checked out. Which environment is "Which Codex
  environment", below; until 2026-10-31 it was the repository's full name
  and then its bare name, tried as labels, and one named neither has been
  `SESS_010` since then (below); any other refusal is the CLI's, in its
  words (`SESS_009`).
- **Status comes from the host, not the browser.** Unlike `claude`, the
  Codex CLI answers it: the runner reads `codex cloud list --json` once a
  minute while a task it started in the last week has not settled, and
  reports pending as working, ready or applied as done, and an error as the
  session failed. OpenAI publishes no limit for these reads; the runner
  asks only while something is unsettled, at most five pages a time, and
  backs off on failure (`link_cloud_codex.go`). The host must be online for
  the state to move.
- **Files ride the task as links**, as for Claude Code's cloud ("Files for
  a cloud session"): the API keeps them and the task ends with a download
  line per file. A Codex environment whose internet access is off cannot
  fetch them: give the environment access to the API's host for files to
  reach the task.
- **Bring it here** is `codex apply <id>` on the session's pane, which
  applies the task's diff to a checkout. A button that opens a worktree
  session with it applied is not built, as for Claude's teleport.
- **No pull request of ours.** A Codex task's result is a diff; the pull
  request is ChatGPT's Create PR. Opening it ourselves (apply, push and
  open with the workspace's GitHub App, as OpenClaw's Gateway publishes a
  cloud worker's changes) is the next step if the owner wants one.
- **How OpenClaw does it, for the record.** Its "Codex cloud sessions" are
  not OpenAI's: they run `codex exec-server` on a machine it leases through
  Crabbox, while the Gateway keeps the app-server, the ChatGPT login and
  the transcript. That is our VM slice, not this one, and keeping a ChatGPT
  login in our control plane is what F23 rules out.

### Environments the CLI cannot reach (2026-10-31)

Starts failed with "environment 'oppenheimer' not found" on a repository
whose environment existed, and nobody could tell why. ChatGPT has two lists
of Codex environments. The one `codex cloud exec --env` resolves is the
older list at `/wham/environments`, the one the `codex cloud` TUI browses.
The newer one, ChatGPT Settings → Codex Cloud
(`chatgpt.com/settings/codex-cloud`, with publish and snapshots), is
invisible to the CLI as of codex-cli 0.166.0, the latest: there the owner's
CLI saw `adri-rodrigo-seo-crm`, `kallista` and
`woocommerce-elementor-ai-template`, while Settings showed `oppenheimer`
and `xrp-mobile`, published and unusable. Decided:

- **Its own code.** A start that every label refuses as "not found" is
  `SESS_010`, not the CLI's words under `SESS_009`. Its detail names the
  labels tried, says that Settings → Codex Cloud environments are not
  reachable by the CLI yet, and lists the environment labels on the
  account's twenty newest tasks.
- **That list is partial, on purpose.** codex-cli has no command that lists
  environments outside its interactive TUI (`codex cloud` has `exec`,
  `status`, `list`, `apply` and `diff`); the only non-interactive view is
  `environment_label` on `codex cloud list --json`. Reading
  `/wham/environments` ourselves would mean reading the CLI's
  `auth.json`: the CLI owns its credential, and the host never reads it
  (brief, "never"). An environment no recent task ran in is missing from the
  list, and the full one is `codex cloud` on the host.
- **The console explains it.** The failed start's pane says, in the
  reader's language, that the CLI reaches only the environments
  `codex cloud` lists and that Settings → Codex Cloud ones are not among
  them yet, with a link to that settings page; the host's detail stays the
  secondary line.
- **The place picker does not predict it.** Marking the Codex row
  unavailable for a repository with no environment the CLI can see would
  need that list, cached per host. The only list there is is the partial
  one above, so the mark would be wrong for every environment no recent
  task ran in, and would hide a start that works; it is not built. It comes
  back when the CLI lists environments non-interactively, or reads the
  Settings ones.

### Still out of reach, and said earlier (2026-11-11)

Issue 835 asked whether a newer integration reaches the Settings → Codex
Cloud environments. It does not (`research/cloud-agents.md` §7, read in
`openai/codex` at `d27e7c1`): `codex cloud` still resolves `--env` against
the older list, which ChatGPT now calls Codex Cloud (Legacy); the current
environments sit behind a service the CLI reaches only from its
interactive TUI, under a feature that is off and under development, with
no way to name an environment; and the Agents API is a platform product
on an API key and API billing with sandboxes of its own. Decided:

- **The host's CLI and its sign-in stay the driver.** Nothing about who
  signs in or who is billed changes. The Agents API as a second Codex place
  is a product decision for the owner, not taken.
- **The picker says what it leaves out.** Under the list: only Codex Cloud
  (Legacy) environments are listed, and the host cannot start a task in one
  made in Settings → Codex Cloud. When the host could only read its recent
  tasks (`source: tasks`), it says the list may be missing some. This is
  the cheap half of "The place picker does not predict it" above: no mark
  per repository, one sentence for every reader.
- **The refusal gives the ways out.** `SESS_010` and its pane now say that
  such an environment starts only from ChatGPT, and to pick a legacy
  environment or start the task there; "not reachable yet" promised a fix
  nobody has announced. Two more refusals read as `SESS_010` instead of the
  CLI's bare words: an account with no legacy environment at all ("no cloud
  environments are available"), and a picked environment the CLI no longer
  has.
- **Not signed in is its own code.** A host whose `codex` has no ChatGPT
  sign-in refuses a start with `SESS_022` ("run codex login on the host"),
  as Claude's does with `SESS_019`, and its picker with `SESSIONS_055`,
  instead of "Codex could not list its environments".

### Which Codex environment (2026-10-31)

A Codex task runs in one of the ChatGPT account's environments, and an
environment is named by its owner on chatgpt.com/codex: nothing makes it
the repository's name. Guessing the label from the repository failed as
soon as one was not (`environment 'oppenheimer' not found`), and the
person had no way to say which. The owner asked to improve it, and of
three ways chose both of the first two: the host lists the environments
and picks the one linked to the repository, and the composer lets the
person pick another.

- **The host lists them** (`codex.environments.list` →
  `codex.environments`, capability `codex.environments`). The Codex CLI
  has no command that lists environments: its TUI reads them from the
  ChatGPT backend it starts tasks on, `GET /wham/environments` and
  `GET /wham/environments/by-repo/github/{owner}/{name}`, with the sign-in
  `codex login` keeps in `$CODEX_HOME/auth.json`
  (`codex-rs/cloud-tasks/src/env_detect.rs`). The runner does the same on
  the host, as `oppenheimer-runner`; the sign-in never leaves the host and
  the control plane never sees it, so F23 holds. Those endpoints are not
  published and the token is the CLI's: if OpenAI changes them, or the
  sign-in is in the key ring, the runner lists instead the environments the
  account's recent tasks ran in, off `codex cloud list --json`, which names
  each task's (`source: tasks`). The owner chose this knowing the endpoints
  are unpublished; whether reading the CLI's token for this one read is
  within OpenAI's terms is the open question below. It also contradicts
  "Environments the CLI cannot reach" above, which decided the host never
  reads `auth.json`; which of the two holds is the owner's to decide.
- **With none picked, the linked one.** Among the environments linked to
  the repository the runner takes the only one, else the pinned one, else
  the one with the most tasks: what Codex's own picker does
  (`pick_environment_row`), passed by id. With none linked, the one
  labelled with the repository's full name, then its bare name, still by
  id; with neither, the start is `SESS_010`, naming every environment the
  CLI can reach (that list is complete here, not the tasks' partial one). The CLI is handed the names as labels only when
  the account's whole list could not be read.
- **Picked in the place chip, as the frame draws it.**
  `NewSessionComposer.dc.html` drills from a cloud account under Cloud into
  its environments, each with a line on its right and "Environments live in
  your Codex account" under them, and the chip then reads
  "<environment> · <account>". Here the host stands for the account (it is
  the ChatGPT sign-in the host's `codex` holds): the Codex row's Start from
  pane, on a host, opens that host's Environments pane, asked of the host
  when it opens (`GET /v1/hosts/:id/codex-environments`, live, nothing
  cached, the repository optional; `SESSIONS_044`–`047`). Auto leads and
  names the host's pick; the others are the account's, linked ones first,
  marked Linked or Pinned. The chip reads "<environment> · <host>". A pick
  is kept with the host it was made on, since each host lists its own
  ChatGPT account's environments, and remembered with the draft. The frame's
  saved Environments tab and its New environment dialog are not built.
- **ChatGPT's 429 is a stop.** The reads count against the host's ChatGPT
  account. A 429 pauses that account for its `Retry-After` (a minute when it
  names none); nothing else is asked in its place, and a start in the pause
  is refused too, since the CLI would read the same list. The runner's
  `SESS_011` is the API's `SESSIONS_047`, a 429.
- **The pick is part of the launch.** `codexEnvironment` on
  `POST /sessions` is folded from `session.requested` into
  `work_session.launchEnvironment` with the model, permission and effort,
  so a `session.create` sent again after a reconnect starts the task in the
  same environment. A runner older than `codex.environments` ignores it and
  guesses.

Open: whether OpenAI's terms allow a third-party process on the person's
machine to use the Codex CLI's ChatGPT token for this read. If not, the
runner keeps only the `codex cloud list` source and the chip lists the
environments the account has used.

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

## The chat of a cloud session (2026-11-07)

The owner asked to see a Claude Code cloud session's chat in the console and
answer it there, the way claude.ai shows it. The research is
`../research/cloud-chat-bridge/README.md`; what was built:

- **The session sends its own chat.** A cloud session streams to claude.ai
  over Anthropic's private session API, which we cannot join, but Claude
  Code also writes the same conversation to its transcript file in the VM.
  A SessionStart hook in the repository starts a streamer that follows that
  file and posts its lines to `POST /v1/sessions/cloud-transcript`, numbered
  so a resend stores nothing twice, in batches under the API's body limit
  (a line over 64 KB has its long strings cut short). The API keeps them in
  `session_cloud_line`, for the cloud sessions this workspace launched only
  (`SESSIONS_053` otherwise), on a personal token with `cloud-chat:write`:
  a scope that reaches the two hook endpoints and nothing else of a
  session. It was `sessions:write` until 2026-11-07, which could also
  start, stop and delete sessions, too much for a key kept in a cloud
  environment's plain-text variables.
- **The console draws it with the chat it already has.** A Claude Code
  cloud session's pane reads `GET /v1/sessions/{id}/cloud-chat` from where
  it stopped, every 1.5 s, into the same `SessionChat` a host session's
  terminal feeds. Until a line has come it is the cloud pane it was.
- **A reply waits for the agent's turn to end.** The composer's message is
  kept (`POST /v1/sessions/{id}/cloud-replies`, `session_cloud_reply`) until
  the session's Stop hook collects it (`POST /v1/sessions/cloud-replies/take`,
  waiting up to two minutes) and hands it to the agent as its block
  decision, Claude Code's documented way for a hook to keep an agent going.
  Claude Code keeps that as a hidden "Stop hook feedback" line, which the
  console reads as the person's message, where the agent took it.
- **What it cannot do.** An idle session is only woken by a message, so a
  reply typed after the Stop hook gave up waits for the next turn; waking it
  from a host (`claude -p … --cloud <id>`) is the next step. Stop does
  nothing: no hook can interrupt a turn. A session started on claude.ai,
  not from the console, is refused until there is a way to adopt one.
- **Decided with the owner (2026-11-07).**
  1. A session started on claude.ai, not from the console, keeps no chat
     here: only sessions the console launched (`SESSIONS_053`). Not adopted.
  2. A reply to an idle session is sent from one of the person's hosts,
     signed in to the same claude.ai account (`claude -p … --cloud <id>`),
     so it wakes the session. The next pull request.
  3. The console gets a "turn on chat" panel on a cloud session: the key,
     the hooks to add to the repository, and the host to allow in the cloud
     environment. The next pull request.
  4. Stop and the Terminal/Chat switch are hidden on a cloud session's chat,
     where neither can do anything. The next pull request.

## Follow-ups to a cloud agent (2026-11-05)

Jordi asked for two-way messaging between bots and coding agents, cloud
sessions included, through supported vendor APIs only. What each cloud
allows:

- **Cursor: supported.** A follow-up is a new run of the same agent,
  `POST /v1/agents/{id}/runs` (`research/cloud-agents.md`), sent by
  `send_to_session`, `POST /v1/sessions/{id}/prompt`, MCP and `opp` alike
  (`CloudFollowUpResolver`). It is claimed in the log as `prompt.sent`
  first, then sent on the launcher's key; a refusal that certainly did
  nothing at Cursor is `prompt.undelivered` and the vendor's code. A
  failure that may have reached Cursor (a timeout, a 5xx) is not called
  undelivered: it is `SESSIONS_051`, the claim stays, and the next
  follow-up is held off for 15 minutes, so a retry never runs the same
  instruction twice on the launcher's key. Nothing is queued: while a
  run is on, the API refuses (`SESSIONS_036`), and Cursor's own `409
  agent_busy` is `CLOUD_AGENTS_012`. Only the person who launched the
  session may send one, since it bills their key (`SESSIONS_050`). The new
  run becomes the one the session follows, and its status folds into the
  log like any sync's, so a bot following the session is woken when it
  ends.
- **Claude Code: not here.** `claude -p --cloud <id>` queues a follow-up
  from a host's CLI, but the runner does not drive it and a session's
  conversation is not ours to read; the prompt is refused (`SESSIONS_038`)
  with the claude.ai link, as before. *Changed 2026-11-07:* a session whose
  repository carries the hooks sends its chat and takes replies through
  them ("The chat of a cloud session", above).
- **Codex: not here.** Follow-ups exist in ChatGPT only; refused the same
  way, with the chatgpt.com link.
- **Reading the conversation.** None of the three: see
  `agent-tools.md` §8. Open question 5 below stays open.

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

## Bots (2026-11-02)

The owner asked that bots start every kind of cloud session, not only
Claude Code's. `start_cloud_session` takes an `agent`: `claude-code` (the
default) or `codex`, which a host starts through `POST /sessions`'s command
with `cloud: true`, Codex with an optional environment; or `cursor`, which
is `StartCloudSessionCommand` on the owner's own key with no host. They are
the same commands as New session, a task and an automation, so the bot gets
no rule of its own: a missing key is `CLOUD_AGENTS_004`, a host that cannot
start the cloud is the session's own failure. The approval card says a
Cursor session runs on the owner's Cursor key, since it bills their plan.
The tool lists `CLOUD_AGENT_PROVIDERS` beside `HOST_CLOUD_AGENT_IDS`, so the
next vendor is a value there too (`25-bots.md` §4.2).

## Questions to answer first

1. ~~Does the control plane holding a person's Cursor API key need F23
   reworded to "no subscription sign-in"?~~ Answered 2026-10-26: F23
   carries a dated line saying so (`../04-security-review.md`).
2. Which version takes it, and does the first step (remote features for
   host sessions) go into 0.7 with the chat? Cursor and Claude landed
   ahead of any version; Codex and Grok still wait on this. Codex landed
   ahead of a version too (2026-10-29); Grok still waits.
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
