# Lessons from the reconstructed Grok Bot desktop app (formerly note 12)

Source: `b-nnett/grok-bot-0.18-reconstructed`, an unofficial
reverse-engineering of a macOS Electron app into readable TypeScript,
archived August 2026. It is a proprietary product rebuilt from its
compiled form, so this note takes ideas from its architecture and no
code. Internal names use the prefix `sand` (sandbox), and a virtual
terminals path under `/root/.cursor/projects/workspace/` suggests the
box runtime was shared with Cursor's background-agent infrastructure.

## 1. How its remote connection works

```
desktop app (Electron main)
  ├─ broker call: ensureSandBox() ──► { gateway URL, bearer token, network token, VNC URLs }
  │     cached as a "gateway descriptor"; env override SAND_HOST_GATEWAY_URL for dev
  ├─ box host connector: HTTP/1.1 + Connect-RPC to the box gateway, Authorization: Bearer
  ├─ egress tunnel: outbound WebSocket from the desktop, so the box's traffic can exit via the user's machine
  └─ VNC edge: a desktop inside the box, proxied to the app for computer use
box ("forever box", one per user, persistent)
  ├─ box host: gateway server + plugin extensions (transcript, inference, automations, MCP, forever-box)
  └─ exec daemon: Connect-RPC over HTTP on 127.0.0.1:1337, bearer "local"
        runs /bin/sh -lc with pipes, no PTY
        background terminals persisted as numbered text files with YAML frontmatter
```

Details worth knowing:

- **Broker, not discovery.** The app never finds the box; it asks a
  broker, gets a descriptor with URL plus two tokens, and caches it. The
  broker can answer with a **blocked hint and a retry-after**, held for
  60 s by default and at most 15 min, and with an **update-required
  hint** that forces a client upgrade before it may connect.
- **Two token headers.** A bearer token for the gateway and a separate
  "network token" header that also unlocks the VNC proxy. Same idea as
  our per-session ticket plus the runner's session token.
- **Forever box.** A persistent per-user box with an image that
  auto-updates. Update means **recreate with `preserveData`**; reset
  means recreate without it. A disk-pressure guard watches the box's
  storage and surfaces it as a status event.
- **Migration is a first-class, resumable stream.** Recreate or move
  emits phases `backing-up → creating → moving → cleaning-up → wiping →
  done | failed`. The client `watch()`es the stream with an **offset
  key**, reconnects every 3 s on drop, declares a stall after 30 s of
  silence, and gives up after 20 reattaches. The last terminal event is
  remembered so a late client still gets the outcome.
- **Recovery is explicit.** `recreateComputer({preserveData, force})`,
  `restartCoordinator()`, `updateForeverBox()`; an epoch counter drops
  stale connect callbacks so a reconnect that lost the race cannot
  overwrite a newer connection.
- **No PTY.** The exec daemon pipes stdio and buffers it; there is no
  resize and no interactive terminal. Long-running shells are written to
  files (`1.txt`, frontmatter, interleaved output, exit footer) that the
  agent reads back as tool results.
- **Local Docker mode.** The same box host and exec daemon can run in a
  loopback-only local container, validated before the coordinator
  connects, with content-addressed artifacts mounted read-only.

## 2. What we take

| Idea | Where it lands |
|------|----------------|
| Descriptor from a broker, cached, with blocked and update-required hints | the control plane's session attach: a ticket that also carries "runner busy, retry after" and "runner too old, update" instead of bare errors |
| Migration as a phased, resumable event stream with offsets and stall detection | host moves (note 10 §4, i7 to AX42), workspace VM recreation on image update, and hibernate-to-wake progress in the session card |
| Update = recreate with data preserved | workspace VM image revisions: recreate the VM from the new golden image, keep the overlay's worktrees and the account volumes, one command |
| Disk-pressure guard as a status event | per-host disk watch, surfaced on the sidebar before a session fails to write |
| Epoch counter on reconnect | the browser-to-relay and runner-to-control reconnect ladders, so a late success cannot clobber a newer connection |
| Background terminals persisted as files with frontmatter | the format for a session's archived scrollback in the event log: header, output, exit footer, readable by humans and agents |
| Loopback local mode with the same daemon | a local dev mode of the runner on a laptop for building the product itself, no VM |

## 3. What we deliberately do not take

- **Pipes instead of a PTY.** Its agents get command output as text;
  ours get a terminal. That is the product difference, and note 01 stands.
- **One forever box per user.** We have one workspace VM per repo plus
  clean VMs, which is finer-grained and matches the worktree UX.
- **VNC in the box for computer use.** Interesting for the Mac Studio QA
  case, but there the agent runs on the Mac itself and drives the
  simulator directly; no VNC hop is needed. Revisit if remote GUI
  sessions ever matter.
- **An egress tunnel through the user's desktop.** It exists so the box
  can reach things only the user's machine can reach. The tailnet gives
  us that without a tunnel: a session's VM can reach a tagged device on
  the tailnet if the host is allowed to, which is a firewall rule, not
  a subsystem.
- **A plugin-extension host.** The gateway is a bus of 34 extensions.
  That is the OpenClaw shape again, and note 00's verdict stands.

## 4. Verdict

The remote connection itself is unremarkable: HTTP with bearer tokens to
a gateway, an exec daemon behind it. What is worth copying is the
operational layer around it, which is where a product like this spends
its second year: brokered descriptors with structured hints, resumable
migration streams, recreate-with-data-preserved updates, disk pressure,
and epoch-guarded reconnects. All of it fits the runner and control
plane as designed, without changing a boundary.

## 5. Grok Bot 0.71.2: the bot itself (2026-10-15)

Sections 1 to 4 read version 0.18's connection layer. On 2026-10-15 a
static read of version 0.71.2, built by Anysphere on Cursor's agent
stack, looked at the bot instead of the box, for the bots design
(`versions/mvp/25-bots.md`). It found:

- **The loop moved to the vendor's servers.** The desktop app no longer
  runs the agent; it is a client of a loop that runs elsewhere.
- **A curated chat.** Only what the bot sends reaches you; the tool
  calls behind it are not the conversation.
- **Memory as files, with a source on each fact.** What the bot
  remembers says where it learned it.
- **Layered approvals.** More than one level decides whether a tool call
  runs without asking.
- **Bots that edit themselves without asking**, with no history to go
  back to.

What note 25 takes from it, and what it does differently, is that
note's "Research" section: the curated chat, the source on each fact,
queue lanes and a bounded chain for bot-to-bot turns, taken; revisions
for the bot's documents and the owner's own permissions as the ceiling,
where Grok Bot has neither.

## 6. Grok Bot's onboarding, from its own docs (2026-10-16)

The desktop installer could not be fetched from this environment (the
download page and the reconstructed repository both refused it), so this
section reads xAI's published guide instead
(`docs.x.ai/grok-bot/get-started`, `docs.x.ai/grok-bot/bots`), which is
what a person sees anyway. No code is taken.

- **First run is a tour, then a roster.** Sign-in, a short introduction of
  bots, the shared computer and routines, a question about which tools the
  person uses (it shapes suggestions, connects nothing), the computer
  setting up in the background, and a **"Meet a future teammate"** screen:
  pick a suggested teammate or create your own.
- **A new bot is "New Bot" until edited.** Creating one opens it under
  that name; name, label, description and avatar are set in Edit Profile.
  The guide asks for a short name, **one primary job**, and a description
  of how it should work.
- **Name it after the job.** Its examples are Talent Scout, Expense
  Manager, Bug Reproduction, Account Health; "General Helper" is the
  counter-example, because a vague bot gets less guidance and its saved
  context is harder to reuse. Focused bots over one catch-all.
- **The description holds durable rules:** what the bot owns, which
  sources it uses, and what it must never do without approval. The
  conversation holds the task of the moment.
- **Memory is not authoritative.** Changing facts stay in their source
  system; ask the bot to reopen current data before a consequential call.
- **Pin, hide, duplicate, share as a template.** Duplicating copies the
  profile, skills and routines but not history or memory.

What we take (`versions/mvp/25-bots.md` §1): the one focused job, the
description as the job, the rules a bot must never break without asking,
and the first concrete task. What we do differently: the bot does the
setup itself in its first chat, so nobody has to find Edit Profile, and
it is born with a first name rather than "New Bot", since a sidebar of
"New Bot 2, New Bot 3" says nothing. The welcome tour, suggested
teammates and templates wait for 25 §7's templates.

## 7. Grok Bot 0.71.2: how a bot wakes (2026-10-16)

A second static read of the same release, the Linux `.deb` from
Cursor's download page, unpacked from its `app.asar`, for how a bot works
when nobody writes to it. The scheduler runs on the vendor's servers, so
this is what the client's protobuf schemas, its copy and its prompts
show, not the scheduler itself. Ideas only; the design they fed is
`versions/mvp/26-bot-routines.md`.

- **No heartbeat of its own.** A bot wakes for five reasons only: a
  message, a routine firing, a channel (Slack, GitHub, email) through a
  routine, another bot, or background work it started finishing. A
  process on its computer cannot wake it; users ask for that on Cursor's
  forum and staff answer it is being worked on.
- **Routines are automations with one trigger** each: a schedule, Slack,
  GitHub, Microsoft Teams, Linear, Sentry, PagerDuty, email, or a webhook
  with its own API key. Schedules are a cron in the user's zone or an
  `@every` interval, an active window ("every 30 minutes, 9:00 – 18:00"),
  weekdays, or one date. A schedule with a window or a fire time reads
  "around" instead of "at": it is spread, not on the minute.
- **The bot manages its own routines** with one tool (`UpdateRoutine`:
  create, update, pause, resume, delete), and saving one asks first.
  Routines brought in by a template are created paused, and the bot asks
  once whether to turn them all on.
- **A spend guard.** When a bot's routines keep running and nobody reads
  the results, it first asks (*keep them running*, *pause them all*,
  *keep running, don't ask again*), then pauses them all and says so.
- **Wakes are durable.** A bot watching a cloud agent registers a
  watcher (durable or not, with a count of the wakes it caused);
  finished background tasks and subagents reach it as a completion
  carrying a system reminder; pending wakes live in a ledger that
  survives a host restart; a subagent wakes its parent with `WakeParent`.
- **Missed is missed.** A scheduled computer update the box slept
  through by more than an hour is not run late; it asks for a new time.
- **Offline fallback.** When the routine sync fails, event routines keep
  running locally where that is safe; scheduled ones may not.

What 26 takes: routines as automations with a bot as the target, the
spread schedule, and routines from templates starting paused. What it
does differently: a routine's run is a queued turn of the bot, so the
turn queue is the durable record and there is no wake ledger beside it;
"when a session ends" is a trigger like any other rather than a watcher;
no spend guard yet, the run budget holds the cost; and the owner's
permissions are the ceiling, as in 25.

### Second read: routines in detail (2026-10-18)

A closer read of the same client for how a routine is made, shown and
guarded. The server owns the routine tool, the fire and the spend guard's
thresholds, so those stay unknown.

- **One tool, chat first.** The bot has a single `UpdateRoutine` tool
  (create, update, pause, resume, delete); saving asks "Allow {bot} to save
  a routine?". The routine spec is a name, a prompt, one trigger or a group
  of two or more, and enabled.
- **Triggers** are a cron (five fields, `@every N` with a phase, a
  `CRON_TZ=` zone, one date for a one-shot, an optional window that makes
  it read "around"), Slack (mention, keyword, message, reaction),
  GitHub (fifteen PR, review, issue and CI events), Linear, Sentry,
  PagerDuty, Microsoft Teams, email to the bot's own inbox, and a webhook
  with a key per routine.
- **The chat shows changes, not just runs:** "Created routine *X*", folded
  into "Routines in this change" when there are several, and a "Routine *X*
  failed" notice.
- **The Routines pane is read-only.** A row has a switch, a menu with
  Test, Edit and Delete, and a detail with the instruction, *when to run*
  and, for a webhook, its URL and key. Edit drops "Edit your routine: *X*"
  into the composer.
- **The spend guard** is two cards, a nudge with *keep*, *pause* or *keep,
  don't ask again*, then a pause with *resume* or *keep paused*.

Note 26 takes all of it as behaviour, with thresholds of its own.
