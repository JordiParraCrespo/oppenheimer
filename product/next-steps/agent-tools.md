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
  wake in its chat beyond the prompt it typed. A bot subscription to a pull
  request (`../versions/mvp/27-bot-subscriptions.md` §7) can wake through
  the same events.

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
