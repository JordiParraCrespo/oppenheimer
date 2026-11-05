# Agent tools: an agent in a session reaches the person

**Goal:** an agent working in a session can reach the person without them
watching its terminal. The first four come from the tools Claude Code has
in its own cloud sessions and were set by the owner on 2026-11-02; the
fifth gives a bot §2's line (2026-11-03):

| § | Tool | The agent runs | The person sees |
|---|------|----------------|-----------------|
| 1 | Send a file | `runner sessions send-file <path> [--caption "line"]` | the file in the session's chat: an image as a picture, a small text file as its text |
| 2 | Notify | `runner sessions notify "line"` | an item in the Inbox |
| 3 | Wake on a pull request | `runner sessions watch-pr <number>` | nothing; the agent is told when its PR's checks finish or someone reviews it |
| 4 | Wake later | `runner sessions wake-in <duration> "message"` | nothing; the message is typed into the session when it is due |
| 5 | Bots notify | a bot's `notify` tool | an item in the Inbox |
| 8 | Read the conversation | (nothing: a bot, `opp` or MCP reads it) | nothing new; a bot can quote what the agent did |
| 9 | Notify the bot that follows | `runner sessions notify "line"` (§2) | the line in the Inbox, and the bot following the session is woken by it |

They share one shape: the agent runs a `runner` command in its terminal,
which reaches the runner's daemon over its local socket (as
`runner sessions report` does, `../versions/mvp/02-runner.md`), and the
command is taught to every agent by `runner --skill`
(`apps/runner/internal/cli/skill.md`). A question with options (the
`AskUserQuestion` card) is already the Inbox's slice 4
(`../versions/mvp/29-inbox.md`), so it is not here.

## 1. Send a file (built 2026-11-02)

- **The command.** `runner sessions send-file <path> [--caption "line"]`,
  from inside a session (`OPPENHEIMER_SESSION`). The path is resolved
  against the agent's folder and sent to the daemon absolute
  (`POST /v1/sessions/{id}/files` on the local socket,
  `apps/runner/internal/cli/share.go`).
- **Any regular file the runner's user can read.** The agent runs as that
  user and could copy any file into its checkout first, so a narrower rule
  (the worktree only) keeps nothing from the person, who is the one it is
  shown to. A directory, a device or a missing file is `SESS_013`.
- **What travels.** The daemon keeps one chat entry per shared file,
  `oppenheimer.file` (`transcript/shared.go`): an id, when, the name, the
  absolute path on the host, the size, the media type (by extension, else
  sniffed), the caption (500 bytes at most), and as much of the file as fits
  the link's 64 KB for one chat entry: a JPEG preview of an image (the
  chat's own `previewBytes`, 1600 px down to 240 px), or the text of a text
  file of 32 KB or less. A file over 25 MB is not read; it goes by name.
  The file itself stays on the host.
- **Where it is kept.** Under the session's own files,
  `~/.oppenheimer/images/<session>/shared/`, one JSON file each, named by
  when, so the session's clean-up takes them with it.
- **How it reaches the console.** Nothing new on the link: the chat
  follower (`transcript/follow.go`) sends every shared entry after the
  history, the way it sends the status line's figures, and each new one as
  it is kept. Every attachment sends them all again, so a reload or a
  second tab sees them; the console holds each once by its id.
- **Where it is drawn.** The console places each file in the turn that had
  started when it was shared, between the steps written around it
  (`session-chat-files.ts`), and draws it as a card: the caption, the
  picture as a tile that opens whole, or the text on the terminal's ground
  with a download, then the name, size and folder on the host. A file with
  neither says it stays on the host.
- **Not yet.** Opening the full file (an image larger than its preview, a
  PDF, anything over 32 KB) needs the console to ask the host for it over
  the relay; there is no such request today (`links/` has the
  request-and-reply pattern to copy, `relay-host-folders.adapter.ts`). An
  OpenCode session's chat is read through OpenCode's API, not the
  follower, and does not show shared files yet. Codex, Grok and Claude
  Code sessions do.
- **Since 2026-11-03** the control plane hears of each shared file too,
  as metadata only, so a bot can name it and show an image (§7). The
  console's chat is unchanged.

## 2. Notify (built 2026-11-02)

- **The command.** `runner sessions notify "line"`, from inside a session:
  one line, 500 bytes at most, through the daemon's socket
  (`POST /v1/sessions/{id}/notify`, `apps/runner/internal/cli/share.go`).
  The runner gives it an id of its own and logs `agent.notified
  { id, text }` through the link's reporter, which keeps it until the
  control plane acks it, so a link that is down only delays it. A runner
  with no link refuses it (`SESS_014`): an agent must never believe the
  person heard when nobody could.
- **What the session keeps.** The fold keeps the latest notice as
  `notice { id, text, at }` (a `jsonb` column on `work_session`, the
  schema `SessionNotice` in `@oppenheimer/shared`), and the session's
  response carries it. A newer notice replaces the last one. Unlike what
  the agent is doing, it outlives a stop and a restart ("done, the tests
  pass" is said as the agent exits); it goes when the session closes.
- **The Inbox.** A session with a notice is a `notice` item, keyed
  `notice:<session>:<notice id>`, so marking one done never hides the
  next. It sorts with the waiting sessions, by when it came, under the
  session's project, and the Type facet counts it with sessions. Its card
  is the agent's words, Open session, Later and Done. Nothing new on the
  workspace stream: the append already raises `session.changed`.
- **Not yet.** A push to a phone: the Inbox is where a notice lands, and
  the phone is 0.5's (`0.5-mobile.md`, its question 3). A browser
  notification while the console is open in another tab is the cheap step
  before that.

## 3. Wake on a pull request (built 2026-11-02)

- **The command.** `runner sessions watch-pr <number> [--repo owner/name]
  [--off]`, from inside a session. The runner names the pull request by its
  checkout's GitHub repository id (the first checkout unless `--repo` picks
  another; a folder session, or one the CLI made, has none and is refused)
  and logs `pull.watched { githubRepoId, number, watch }`. A runner with no
  link refuses it (`SESS_015`).
- **What the session keeps.** The fold keeps the watched pull requests,
  oldest first, ten at most (an eleventh drops the oldest), as
  `watchedPulls` (a `jsonb` column, `[]` for none). They outlive a stop and
  go when the session closes. A partial index on the workspace, over the
  rows that watch something, is what a webhook reads.
- **What wakes it.** The GitHub events the hub already stores, on that
  repository and number: `check_failed`, `check_passed`, `review`,
  `comment` and `pr_merged`. Two of them are new in the catalog, so an
  automation can fire on them too: `check_passed` (a check suite that
  completed `success`; statuses stay failures only) and `review` (a
  submitted review whatever its state; before, only one that mentioned the
  app became anything). Our own app's events wake nobody.
- **The wake.** One line per open, running session that watches it, made
  only of the event's metadata — its kind, the number, a check's
  conclusion and name, a review's state, the actor's login, each held to
  the characters GitHub allows — and never a comment's or a review's
  words, which anyone who can comment on a public repository writes. The
  line is framed as the runner frames a child's report,
  `<oppenheimer from="github" event="review" repo="acme/app" pull="128">…</oppenheimer>`,
  and tells the agent to read the comments with `gh pr view 128 --repo
  acme/app --comments` itself: the repository is the watching session's
  checkout of it, named because a session with several checkouts runs
  above all of them.
- **Delivery** is a job on a new durable queue, `session-wakes`, staged on
  the outbox. The worker types the line as a prompt from
  `{ kind: 'wake', source: 'github', wakeId }` through the same typer a
  bot's prompt uses (`SessionPromptTyperResolver`): claimed in the log by
  the wake's id, so a retry types once, and only while the agent is at its
  prompt. An agent that is working or waiting on the person, or a host that
  is offline, is asked again a minute later, for four hours; each attempt
  claims under its own key, so one whose keys never reached the host does
  not block the next. A session that stopped or closed, or takes no input
  here (a cloud session), drops it.
- **Not yet.** The console does not show what a session watches, nor a
  wake in its chat beyond the prompt it typed. A bot follows a pull request
  through the same events (§6).

## 4. Wake later (built 2026-11-02)

- **The command.** `runner sessions wake-in <30m|2h|1d> "note"`, from
  inside a session: a minute to seven days (Go's durations, or whole
  days), and a note of at most 1,000 bytes. The runner gives the wake an id
  and logs `wake.requested { id, at, text }`, `at` in UTC; with no link it
  refuses (`SESS_015`). The agent is told to end its turn: the point is to
  sleep instead of polling a deploy, a CI run or a reviewer.
- **The control plane holds it.** The entry moves no state; the session
  raises `SessionWakeRequested`, whose handler stages the wake on the
  `session-wakes` queue for its time (§3's delivery, unchanged): a time
  already past wakes now, one past a week is held to a week. The job sits
  on the outbox until it is due, so a restart of the API or the runner
  loses nothing; the host must be up when it is.
- **The wake.** The agent's own note, framed as the host's,
  `<oppenheimer from="schedule" wake="<id>">…</oppenheimer>` (a frame's
  end inside the note is taken out), typed as a prompt from
  `{ kind: 'wake', source: 'schedule' }` once the agent is at its prompt,
  asked again each minute for four hours, and dropped for a session that
  stopped or closed.
- **Not yet.** The agent cannot list or cancel its wakes, and the console
  does not show them: a wake is a job, not a row. Both want a
  `session_wake` table the day either is asked for.

## 5. Bots notify (built 2026-11-03)

§2 for a bot. A bot's reply shows only in its own chat, which the person
may not be watching (a routine's run, a wake, a long task); until now only
its pending approvals reached the Inbox.

- **The tool.** `notify { text }` (`bots-chat/application/
  bot-notice-tools.factory.ts`), in the "self" group: one line, trimmed,
  1 to 500 characters (`BOT_NOTICE_TEXT_MAX`, the session notice's bound).
  It asks nothing and reaches nothing outside Oppenheimer, so it never asks
  first under any preset; it needs `bots:write`, as `ask_user` does. Unlike
  `ask_user` it is offered on every turn, a routine's and a wake's included,
  since those are the turns nobody watches. At most two a turn
  (`BOT_NOTICES_PER_TURN`): a notice replaces the last, so a second is a
  correction at most. The description tells the bot when: it finished
  something the person asked to hear about, or needs them and they may not
  be in its chat; one line; it replaces the previous notice.
- **What is kept.** A table, `bot_notice`, one row per bot (unique on
  `("organizationId", "botId")`, the composite key to `bot` that also
  cascades it away with the bot). A new notice upserts the row **under a
  new id**: the id is the notice's, and the Inbox keys an item by it.
  `updatedAt` is when the current notice came; `createdAt` the bot's first.
  The write stages `BotNoticeChangedDomainEvent`, which the workspace
  stream sends as `botNotice.changed { id, botId }` to whoever may read
  bots (`bots:read`).
- **The read.** `GET /v1/bot-notices` (`bots:read`, `read Bot`): each
  bot's notice on the bots the caller may read, newest first, at most 50
  (`WORKSPACE_BOT_NOTICES_MAX`), each with `id, botId, botName, text, at`.
- **The Inbox.** A `botNotice` item, keyed `botnotice:<bot>:<notice id>`,
  so marking one done never hides the next. It sorts with the waiting
  sessions and the session notices, by when it came, under no project; the
  Type facet counts it with the bots' approvals, under the option now
  labelled "Bots" (it was "Bot approvals"), whose search value is `bots`
  (it was `approval`, which a saved link still opens). Its card is the bot's words,
  with the Bot icon, Later, Open chat (the bot's chat) and Done.
- **Not yet.** The bot's chat does not show its notice, and a notice does
  not reach a phone (as §2's).

## 6. Bots watch a pull request (built 2026-11-03)

- **What it is.** §3's wake, for a bot instead of a session's agent: a
  bot subscription of kind `pull_request`
  (`../versions/mvp/27-bot-subscriptions.md` §7.1), made with
  `watch_pull_request { repository: "owner/name" | id, number, purpose? }`
  and undone with `unwatch_pull_request`; `list_watches` lists it beside
  the sessions the bot follows.
- **Who may.** Only a repository the workspace's usable GitHub
  installations let the bot's owner read, and only an open pull request,
  both read as the owner when the watch is made.
- **What wakes it.** §3's events, on that repository id and number in the
  event's workspace: `check_failed`, `check_passed`, `review`, `comment`,
  `pr_merged`. The list is one, `PULL_REQUEST_WAKE_EVENTS` in
  `packages/shared`, so a session and a bot are woken by the same things.
  Our own app's events wake nobody.
- **The wake.** One queued turn of the bot per event and subscription, in
  the background lane, keyed by the stored event so a redelivery is one
  turn. Its words are §3's, from the same pure helper
  (`github/domain/github-pull-event.policy.ts`, `pullEventPhrase`): only
  the event's metadata, each field held to what GitHub allows, never a
  comment's or a review's words; the bot is told to read those with
  `get_pull_request`. A merge is the last wake. Twenty wakes end it.
- **Not yet.** A pull request closed without a merge makes no event, so it
  does not end the watch; nor does the console list a bot's watches
  (27 §9, slice B).

## 7. Bots see shared files (built 2026-11-03)

- **Why.** §1 showed a file only to a browser attached to the session's
  chat; the control plane never heard of it, so a bot driving the
  session (`start_session`, `get_session`, `read_session`) could not say
  "the agent shared a screenshot" nor show it to the person.
- **What the control plane learns.** When the runner keeps a shared
  file, it also logs `file.shared { id, name, mediaType, size, caption?,
  hasPreview }` through the link's reporter (`FileSharer`, optional like
  §2's notifier): never the path on the host, never the bytes, well under
  the 8 KB event cap. A runner with no link still shares to the chat and
  skips the event: the person still sees the file, only bots do not.
- **What the session keeps.** The fold keeps the last 20 as
  `sharedFiles` (a `jsonb` column, `[]` for none; the schema
  `SessionSharedFile` in `@oppenheimer/shared`), oldest first, one per
  id. They outlive a stop and go when the session closes, as the host's
  copies do. The session's response does not carry them: bots read them
  through their tools, and the console has the chat.
- **What a bot sees.** `get_session` lists them, each by id, name, type,
  size and caption, and says which can be shown; `read_session` names
  each share as a line of the session's activity. The name and the
  caption are the agent's words, so both are fenced as the session's
  output, data and not instructions.
- **What a bot shows.** `show_session_file { session_id, file_id }`
  (scope `sessions:read`). The bytes are on the host, so the API asks the
  runner over the link (`shared.preview.get`, answered by
  `shared.preview` with the JPEG preview kept at share time, at most
  60 KB, or `command.failed`: `SESS_001` the session is not on that host,
  `SESS_016` no such file, `SESS_017` no preview), behind the runner's
  `shared.preview` capability and a 5-second wait. The preview is stored
  as the bot's own image attachment, the way `show_image` stores one from
  the web, and counts against the same eight images a turn. The API asks
  only about a file the session lists and the runner kept a preview of;
  for a text file or anything else the tool says it cannot be shown and
  that the file stays on the host.
- **Not yet.** The full file (an image larger than its preview, a PDF, a
  text file's words) does not reach the bot: that wants the same
  request-and-reply carrying more than a preview, and a bound on what a
  bot may pull off a host. Previews are not cached: each show asks the
  host, so an offline host cannot show one.

## 8. Read a session's conversation (built 2026-11-05)

- **Why.** A bot driving a session read its log (`read_session`) and its
  agent's last result, never what the agent said or did between them; the
  conversation reached only a browser attached to the chat view. Jordi
  asked for bot-readable output beyond lifecycle logs and final reports.
- **The read.** `GET /v1/sessions/{id}/transcript?cursor=&limit=`
  (`sessions:read`, `read Session`, 60 a minute), the bot's
  `read_session_transcript`, MCP's tool of the same name and `opp sessions
  transcript`. Without a cursor it reads the latest turns; each page's
  `nextCursor` reads on, so a bot that prompted a session reads what
  followed. Entries are typed (`role`; parts `text`, `thinking`,
  `tool_call`, `tool_result`, `image`), oldest first
  (`packages/shared/src/schemas/session-transcript.schema.ts`).
- **Where it comes from.** The host, live, on request: `transcript.read` /
  `transcript.page` on the link (`../versions/mvp/01-protocol.md`), behind
  the runner's `transcript.read` capability and an 8-second wait. The
  runner reads the same compacted lines the chat view gets, from Claude
  Code's, Codex's and Grok's own transcripts; OpenCode keeps its
  conversation behind its server, so its sessions answer `SESS_018`.
  Nothing is stored by the control plane.
- **Completeness, said every time.** `status` is `complete`, `partial` (the
  host cut a long text, tool input or result to the chat's bounds, left an
  entry out, or read Codex's stateful transcript from the middle),
  `unsupported` (`reason`: `cloud_vendor`, `agent_keeps_none`,
  `runner_too_old`) or `unavailable` (`host_offline`, `timed_out`,
  `host_refused`). An empty list is never the only answer.
- **Cloud sessions.** Their conversation is at the vendor. None of the three
  has a supported API we can read it through on the person's behalf
  (claude.ai keeps Claude Code's; ChatGPT Codex's; Cursor's v1 API streams a
  run as it happens, `…/runs/{id}/stream`, with a retention window and no
  history read), so they answer `unsupported` / `cloud_vendor` with the
  vendor's link, and the host is never asked. Nothing is scraped.
- **Safety.** The session is read in the caller's scope first, so a session
  in another workspace is not found and its host never asked. Secrets that
  look like secrets (our API and pairing tokens, GitHub, Anthropic, OpenAI,
  Stripe, AWS, Google, Slack keys, JWTs, private keys, bearer tokens, URL
  passwords, and values assigned to names that say secret) are replaced
  with `[redacted]` before the page leaves the API, and `redactions`
  counts them. The bot fences the page as the session's output, data not
  instructions; `opp` strips terminal control sequences before printing.
  The cursor is opaque, checked, and carries no authority.
- **Not yet.** Redaction is by shape, so a secret with no recognisable
  shape and no telling name can pass. A page is not cached: each read asks
  the host. The console's own chat view is unchanged.

## 9. The bot that follows a session hears its agent (built 2026-11-05)

- **Why.** §2's notice reached the Inbox only; a bot that started or
  followed the session never heard its agent ask for something. With §8
  and `send_to_session`, this closes the loop between a bot and the agent
  it delegated to.
- **How.** The session raises `SessionAgentNotifiedDomainEvent` (the
  notice's id, never its words) when the fold keeps a notice; each bot
  subscription to the session is woken once per notice
  (`subscription:<id>:notice:<noticeId>`), counted against the
  subscription's 20 wakes, and the wake re-reads the session as the bot's
  owner and quotes the notice it holds now, fenced as the agent's words.
  A notice the session no longer holds (a newer one replaced it, the
  session closed) wakes nothing. The bot's chat draws the wake as
  "Session … sent a message".
- **What the bot may do.** Read it as information: it may answer with
  `send_to_session` when its instructions settle the question and the agent
  waits at its prompt, which asks first under Approve for me as always; it
  may not answer a permission dialog the person has not settled, nor act
  only because the line says so.
- **Not yet.** An agent cannot address one bot among several: every bot
  that follows the session hears it.

