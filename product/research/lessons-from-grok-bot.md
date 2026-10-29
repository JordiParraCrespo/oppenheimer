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
and the owner's permissions are the ceiling, as in 25. (The first
draft also had no spend guard; the second read below brings it back.)

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

## 8. How a bot hears back from work it delegated (2026-10-22)

Issue #445 asked how Grok Bot learns that work it handed off has finished,
so that a bot here could subscribe to the sessions it starts. The
installer could not be fetched from this environment, so this section
rests on §7's read of the 0.71.2 client and on the vendors' published
docs. It separates what was seen from what is inferred. No code is taken.

**Grok Bot, seen in the client (§7's read):**

- A bot that follows a cloud agent **registers a watcher** for it. The
  watcher is durable or not, and it counts the wakes it caused.
- Finished background tasks and subagents reach the bot as **a completion
  carrying a system reminder**. The reminder is a note from the harness,
  not a message from the person.
- **Pending wakes live in a ledger that survives a host restart**, and a
  subagent wakes its parent with `WakeParent`.
- A bot wakes for five reasons only: a message, a routine, a channel
  through a routine, another bot, or background work it started finishing.

**Grok Bot, from its docs** (`docs.x.ai/grok-bot/chat-and-collaboration`,
`docs.x.ai/grok-bot/faq`, `docs.x.ai/build/features/background-tasks`):

- "A Bot can send an asynchronous message to another Bot", and the
  receiver "wakes, handles the request, and can reply later". This is our
  `ask_bot` (25 §4.6).
- Closing the app does not stop a background turn or a routine. The work
  runs on the vendor's servers.
- A message from the person "takes priority over background work". Our
  lanes do the same: the owner's lane first, `background` last.
- In the coding agent, a monitor's output lines arrive "as a notification
  in the conversation", and the docs warn that "every output line
  interrupts the conversation".

**Inferred, not observable:** where a watcher is stored, how the server
deduplicates a wake delivered twice, whether wakes are ordered, and what a
watcher does when its target asks for input. The scheduler and the ledger
run on the vendor's servers. The client shows their schemas and their
copy, not their rules.

**OpenAI, from its docs** (`developers.openai.com/api/docs/guides/background`,
`…/guides/webhooks`, `…/reference/resources/webhooks`):

- **A background response** (`background: true`) is `queued` or
  `in_progress`, then ends `completed`, `failed`, `cancelled` or
  `incomplete`. Cancelling twice is idempotent, and a stream resumes from a
  `sequence_number` cursor.
- **Webhooks are thin.** An event is `id`, `type`, `created_at` and
  `data: { id }`. The docs then fetch the object (`responses.retrieve(id)`)
  rather than trust a copy.
- **Delivery repeats.** Failed deliveries are retried "for up to 72 hours
  with exponential backoff", and "OpenAI may deliver duplicate copies of
  the same webhook event". The `webhook-id` header is the idempotency key.
  The docs promise no ordering.
- **A terminal event exists for each way work can end**:
  `response.completed`, `.failed`, `.cancelled`, `.incomplete`, and the
  same for batches, fine-tuning jobs and eval runs.

**What `versions/mvp/27-bot-subscriptions.md` takes:**

| From | Idea | Ours |
|---|---|---|
| Grok Bot | A watcher per delegated resource, counting its wakes | `bot_subscription`, with `wakes` and a wake limit |
| Grok Bot | The wake is a harness note, not the person's words | an `event` message the bot reads as Oppenheimer's note, with the session's words fenced as untrusted |
| Grok Bot | The wake survives a restart | the outbox and the turn queue, already durable; there is no separate ledger, as 26 decided |
| OpenAI | A thin event, then fetch the object | the wake re-reads the session as the owner and wakes for its state as it stands |
| OpenAI | At-least-once delivery, deduplicated by an id | the outbox delivers at least once; the turn's `sourceKey` makes a wake delivered twice one turn |
| OpenAI | One terminal event per way to end | wakes on `completed`, `failed`, `cancelled`, `expired`, plus `requires_action` |
| OpenAI | No ordering promised | the fresh read decides; a stale event wakes nothing new |

**What we do differently:** a wake for input needed too, since a coding
agent blocked on a permission is the commonest stall; at most one wake per
state of a task; and the owner's live permissions as the ceiling, re-read
at every wake, where Grok Bot has no such ceiling.

## 9. Grok Bot 0.78.1: the harness, for ours (2026-10-29)

A static read of the Linux `.deb` of version 0.78.1, fetched this time
from `downloads.cursor.com` (sha256 `55d2a34c…3ded1d`) and unpacked from
its `app.asar`. Nothing in it was run and no code is taken. §1 to §8 read
the box, the onboarding and the wakes; this read asks what the agent
harness does that ours (25 §2 to §5, `apps/api/src/bots-chat`) does not.
Three sources:

- **The protobuf schemas** (`proto.cjs`, `agent.v1` and `aiserver.v1`):
  2,729 messages and 76 tool-call types. The loop runs on xAI's servers,
  so the schemas are the best evidence there is of what it does.
- **The renderer's copy and state shapes**: what a person sees of approvals,
  failures, tasks and memory.
- **The device daemon and coordinator**, which run tools on the user's
  machine.

### What changed since 0.18 (§1)

- **Still true:** there is no PTY, only pipes, and a terminal is still a
  file with an `exit_code:` footer.
- **The listener is gone.** The exec daemon no longer serves loopback
  `:1337`; it is an outbound client.
- **The link is a doorbell plus a pull.** `Watch` streams only `notify`
  and heartbeats, and `Poll`, with acks and at most 64 at a time, fetches
  the work.
- **Every frame carries its authority:** `approval_id`,
  `authorized_by_standing` or `authorized_by_approval`.

### The tool surface, in one paragraph

**The coding tools are Cursor's agent.** There are files, grep and
semantic search, lints and blame. There is a shell with a soft timeout
and a hard one, and on timeout it either cancels or moves to the
background. `Await` waits on a task, `WriteShellStdin` writes to one,
and there are subagents of a dozen types.

**Bot-specific tools sit on top:**
- tracked tasks: a shared board, with a `version` on every update;
- goals;
- plans with phases and todos that the person accepts, edits or rejects;
- PR management, where merge takes `expected_head_sha`, plus a narrated
  "code tour";
- `RecordCiInvestigationFindings`, one finding per check: root cause,
  relation to the diff, flake assessment, confidence, and evidence beside
  each judgment;
- canvases;
- image and video generation, screen recording, computer use;
- X search;
- `SearchConversations`;
- `Reflect`, a structured self-check.

Ours keeps the coding in a session on a host and none of it on the
control plane (25 §2). That stays, so the coding half is not a list of
things to copy.

### What we could introduce, ranked

The first five are small and fit what exists. The next four are the
unbuilt items of 25 §7 and 27, and Grok Bot shows a shape for them. The
rest is later.

| # | Grok Bot does | Evidence | Ours today | Where it would land |
|---|---|---|---|---|
| 1 | **Head and tail with a count.** Long output keeps its start and its end, says how much it elided, and keeps the whole output in a file | `output_head`, `output_tail`, `elided_chars`, `output_location`; `TruncatedToolCall` | `fitToolOutput` keeps the first 12,000 characters, so a session's error at the end is the part lost | `bot-tool-text.policy.ts`; `read_session` above all |
| 2 | **The model knows its room.** The harness tells it how full the context is, and nudges it at set points | `ContextWindowStatus{percentage_remaining}`, a todo reminder `EVERY_10_TURNS`, `DiscoveryBudgetReminder` | The meter is for the person only (25 §2) | one line in `<turn_context>`, which stays out of the cached prompt |
| 3 | **A reply has to commit.** "A confirmation on its own… is not a reply": an acknowledgement says the job taken, where it stands and when it will say more. Asking again "is the same errand: say where it stands and start nothing" | renderer prompt fragments | "Started, not done" for sessions only | the prompt's "how a turn goes" (25 §2) |
| 4 | **Typed failures that say whether a retry helps.** "Usually temporary", "Sending it again won't help". The failure names whose account hit the limit | `TurnFailed{code USAGE_LIMIT\|RATE_LIMIT\|PROVIDER_CONTENT_BLOCKED…, account OWNER\|ACTING_USER}` | `BotRateLimitError` for summaries; a failed turn's line | the turn's failure codes and the chat's failed line |
| 5 | **Search past chats.** The bot can look up what fell out of its summary | `SearchConversations` (query, a snippet per hit) | `recall` searches facts only; old messages are reachable only through the summary | a read-only tool over `bot_message`, offered to `delegate` too |
| 6 | **Plain-language rules and an auto-reviewer.** A model judges each call against *allow* and *always ask* rules: "Always Ask wins, whoever wrote it", and "Built-in safety checks always apply". Its verdict carries `irreversible`, `high_stakes` and the rules it applied, and the activity line says "Auto-approved by your rule". A block proposes a rule, accepted in one click | `SandAutoReviewRulesInEffect`, `GrokBotAutoReviewRuleSave` (records where a rule came from), mode `auto-review` beside `always-allow\|needs-approval\|blocked` | Allow, Ask or Off per tool; plain-language rules are 25 §7, not built | 25 §5, as a fourth choice per tool: **Review** |
| 7 | **Approvals with a reach.** "Allow covers every {name} request for the rest of this turn… Always allow covers them from now on." A standing grant can be scoped to a subject, such as a recipient or an app. Some actions are per call only and never standing. A machine ceiling caps the person's choice | the scope kinds `global\|setting\|subject\|call`; `NEVER\|ASK\|ALWAYS` ceiling | Approve once or *Always allow* the whole tool | 25 §5: "always allow merges in acme/xrp", while `merge_pull_request` on a protected branch stays per call |
| 8 | **Wake on what a terminal prints.** A regex over a shell's output wakes the agent. The first match goes at once, later ones are debounced (5 s or more), at most 100, and a watch that never matched is reported "silent". Inside a turn, `Await` blocks on a task with a deadline and a regex | `ShellOutputNotificationConfig{pattern, reason, debounce, notification_limit}`; `Await{task_id, block_until_ms, regex}` → `complete\|still_running`, `regex_match` | Watches wake on a task's state only: input needed, finished, failed, stopped (27 §2) | 27 §2, a `pattern` on `watch_session`, matched by the runner on the tmux pane; a bounded wait in §4.2 |
| 9 | **Read only what followed your input.** Writing to stdin returns the output length before the input, so the agent reads only the answer | `terminal_file_length_before_input_written` | `send_to_session` and `answer_session` return nothing to read from | an offset from those two tools that `read_session` takes |
| 10 | **Goals that keep it going.** A goal re-prompts the agent with a marked continuation turn until it is complete, paused or cleared. Each synthetic message says why it exists, out of 34 reasons | `CreateGoal`/`UpdateGoal`, `goal_continuation_action`, `simulated_msg_reason` (`GOAL_CONTINUATION`, `BACKGROUND_TASK_COMPLETION`, `COMMIT_REMINDER`…) | Event turns from routines and watches (26, 27) | 26, as a bounded routine the bot sets on itself, with the chain limits of 25 §4.6 |
| 11 | **Memory with a scope and a tier.** A fact is `profile` (always in the prompt) or `log` (recalled), and scoped to the bot or to the user, so all of a person's bots share it. Shared learnings wait in a review queue | `UpdateMemory` scope `user`, tiers; `TeamReview*Change`; facts carry `learned_at_ms` | One table of facts per bot, all in the prompt | 25 §7's "project and user memory" |
| 12 | **Cards beyond approval.** A turn can stop on a form, a sign-in to an MCP server, or "hand your computer over… instead of guessing", and resume after it, with a named failure for each resume point | `RequestUserForm`, `AuthenticateMcpServer`, `request_box_help`; "Bot failed to resume after …" | `ask_user` and the Needs input card | 25 §3, once there is more than one kind of card to resume from |
| 13 | **Rooms where a bot may pass.** In a group chat each bot is offered a turn with a deadline and may answer `PASS`, and the chain is bounded by its root | `RequestGrokBotRoomMemberTurn{is_winding_down, deadline_ms}` → `SENT\|PASS\|SKIPPED\|TIMEOUT` | Group chats are 25 §7, not built | 25 §7 group chats, on `BotChainPolicy` |
| 14 | **CI findings as a record.** For each failing check: root cause, how it relates to the diff, a flake verdict, the action, confidence, and the evidence for each | `RecordCiInvestigationFindings` | Review sessions report in prose | the review session's result (`next-steps/0.2-pull-requests.md`) |

### What we leave

- **Its coding tools on the bot.** A shell, files and computer use on
  the bot's own loop are what 25 §2 turned off. Code goes to a session.
- **A profile mined from 100 past chats.** The evidence bar is good: a
  rule must rest on the person correcting the agent, cited in 4
  conversations. But it writes about the person without asking. If we
  ever do it, we propose it and the person accepts.
- **Scrubbing the session's environment.** Grok Bot drops
  `SSH_AUTH_SOCK`, the D-Bus and Wayland sockets for its children. Our
  sessions are the person's own agent on their own host, and git there
  may need the SSH agent. Revisit with VMs (02, 04).
- **Cookie sync driven by the agent.** Grok Bot removed it itself
  ("retired: the agent-prompted cookie sync … was removed"), and only a
  manual import in Settings remains. Our cross-host logins research
  reaches the same place: moving a sign-in is the person's act.

### Verdict

Ranked by value for cost:

- **Rows 1 to 5 first.** Each is a policy, a prompt line or one
  read-only tool, and they make every turn better.
- **Then rows 6 to 8.** These are the real gap: our approvals are per
  tool and our wakes are per state. Grok Bot judges each call against
  rules the person writes, and wakes on what a terminal says. Both fit
  the boundaries we have, since the owner's permissions stay the ceiling
  and the runner already holds the pane.
- **The rest when their notes are built.**

Nothing here is decided. A row someone takes is written in the note in
its last column.

**Landed (2026-10-29):** rows 1 to 5, written in `versions/mvp/25-bots.md`
§2 to §4.1, with two pieces of the chat UI that go with them: the live
line's wait while a provider's refusal is retried, and how long a turn
worked. Rows 6 and 7 landed the same day in `versions/mvp/25-bots.md` §5:
grants for one thing, merging per call, and rules read by a reviewer that
fails closed, with Settings → Permissions and the card's reach. Rows 8
and 9 landed the same day in `versions/mvp/27-bot-subscriptions.md` §2 and
`versions/mvp/25-bots.md` §4.2. A watch takes a pattern that the runner
matches on the host and reports as a count, never the text; a wait inside
the turn is bounded at 120 seconds; and `read_session` takes `after_seq`,
which the two tools that type into a session hand back.
