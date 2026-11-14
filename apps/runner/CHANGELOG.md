# @oppenheimer/runner

## 0.3.0

### Minor Changes

- db21b92: A bot can drive a terminal. `open_terminal` opens a blank-terminal session
  on a host. `type_in_terminal` types text there, presses named keys, waits for
  a pattern or a few seconds, and returns the screen. `read_terminal` returns
  the screen without typing.

  On the link this is `terminal.drive` / `terminal.screen`, gated on the new
  `terminal.drive` capability. The runner takes it only for a session whose
  window 0 is a plain shell, and only when the host's `runner exec` mode is
  `full`. Refusals are `EXEC_006` (the mode is not `full`) and `EXEC_007` (the
  session is not a blank terminal).

- 434deea: Catch up fast. Every bot has a second built-in skill, `recap`: run `/recap`, or `/recap <topic>`, or ask "where are we?", and it reads your sessions, pull requests, plan and the chat, then answers with where things stand, what waits on you and the next move. A Claude Code session does the same when you ask it to recall or catch you up, from the note the runner writes beside its checkout.
- 9ccced3: A bot can run one program on a paired host. `run_command` is a new tool
  that asks first under Approve for me. It sends `host.exec` over the runner
  link and reads back `host.exec.result`: the exit code, and stdout and
  stderr kept to their last 32 KB each. The new `host.exec` capability gates
  it. The program runs from argv with no shell, in the bot's own folder under
  the host's workspaces (`bots/<bot id>`), for at most 120 s.

  The host decides what may run. `runner exec mode off|allowlist|full` and
  `runner exec allow|deny <program>` write `~/.oppenheimer/exec.json`. The
  runner reads that file on every call, refuses it if another account can
  write it, and starts with the mode off. A refused call is `command.failed`
  with `EXEC_001` to `EXEC_005`.

  `execx.Spec` gains `Output: Separate`, which keeps stdout and stderr apart,
  and `Limit`, which keeps only the last bytes of each stream.

- 3d54930: A bot can watch what a session's terminal prints. `watch_session` takes a
  `pattern`, which the runner matches line by line on the host (new
  `session.watch` / `session.unwatch` commands and the `terminal.matched`
  event, which carries only a count). The match wakes the bot once per new
  count, and the chat shows "Session “X” printed 3 lines matching “FAIL”". A
  wake for a task that ended says when its pattern never matched. Two more
  tools land with it. `wait_for_session` waits up to 120 s inside a turn.
  `read_session` takes `after_seq`, which `send_to_session` and
  `answer_session` now hand back, so a bot reads only what followed its own
  input. A watch sent again on a hello carries its last count, so a runner
  that restarted counts on from it. New errors are `SESSIONS_042` (invalid pattern), `SESSIONS_043`
  (10 patterns per session) and the runner's `INVALID_PATTERN`.
- 8b529a9: A Claude Code session's chat is sent tail first. An attach sends the last 40
  turns, from the line that opens the first of them, and says where they
  start (`before`); scrolling to the top of the chat asks the host for the 40
  turns before that (`chat.older` on the attach socket, `attachment.chat.older`
  on the link, capability `attachment.chat.older`), shown with the spinner
  until the page has come. A reconnect's tail is checked against what the
  chat holds from where it starts, so older pages stay. Codex, Grok and
  OpenCode sessions still send their whole history, and so does any session
  whose console or control plane cannot ask for older turns: the browser says
  it can on the resize that starts the attach (`chatTail`), and the relay
  passes that on only to a runner that names the capability.
- 8baff58: Sessions in Claude Code's cloud. New session's Where offers _Claude Code
  cloud_ on a host: that host's runner fetches the repository with a token
  sealed into the create, runs `claude --cloud <task>` in a scratch checkout,
  reports the cloud session's id and keeps nothing. The session's pane has no
  terminal: its state, _Open in claude.ai_ and `claude --teleport <id>`. Its
  state comes from the Chrome extension, which, connected with a personal token
  pinned to the workspace, posts what it sees on claude.ai to
  `POST /sessions/cloud-status`; the API records it for the sessions the
  workspace launched (`place: cloud`, `cloudSessionId`, runner capability
  `session.cloud`, errors `SESSIONS_037` and `SESS_008`).
- 9f858e0: Fable 5.2 in the engine button for new sessions and in a bot's model button: it takes Fable 5.1's place among Claude Code's current models, at effort `high` by default, and Fable 5.1 moves to the top of "More models". OpenCode's Anthropic row offers `anthropic/claude-fable-5-2` in place of 5.1, which moves behind OpenCode's own "More models" so what was saved on it keeps its effort.
- b39d40f: Claude Code's model list matches Claude's own picker: Opus 5.5, Fable 5.1, Sonnet 5.5 and Haiku 5.5, then Haiku 4.5, Sonnet 5, Opus 5, Fable 5, Opus 4.8, Opus 4.7, Opus 4.6 and Sonnet 4.6 behind a "More models" row in the engine button.
- 55acf65: A reply typed in a Claude Code cloud session's chat wakes the session when
  it is idle (`product/next-steps/cloud-agents.md`, "Waking an idle session").

  - `@oppenheimer/shared`: the link's `cloud.reply` and `cloud.replied`, the
    `session.cloud.reply` capability, the `cloud-reply-wakes` queue,
    `CLOUD_REPLY_WAKE_AFTER_SECONDS` and `CLOUD_REPLY_DELIVERIES`.
  - `@oppenheimer/runner`: names `session.cloud.reply` and answers
    `cloud.reply` with `claude -p <text> --cloud <id> --output-format json`
    on the host's own claude.ai sign-in: `SESS_020` when Claude Code refuses,
    `SESS_021` when it gives no answer in 45 seconds, `SESS_019` signed out.
  - `@oppenheimer/api`: every reply is kept with a wake staged for 15 seconds
    later; if the Stop hook has not taken it, an online host signed in to the
    account of the host that started the session sends it. The hook's take
    and the wake claim the same row, so a reply goes once
    (`session_cloud_reply."deliveredVia"`); one the host certainly did not
    send goes back to the hook.
  - `@oppenheimer/api-client`: a cloud chat reply's `deliveredVia`.
  - `@oppenheimer/frontend-consumer`: the cloud chat feed's `onWaiting`
    becomes `onPending`, with each reply marked `waiting` or `sent`; a reply a
    host sent reads as sent until the transcript has it.
  - `@oppenheimer/web`: the cloud chat's bar says a reply was sent rather than
    waiting.
  - `@oppenheimer/translations`: `sessions.cloudChat.sent`.

- 61f1092: Sessions in Codex's cloud, the way Claude Code's cloud works. New session's
  Cloud tab has a _Codex_ row beside _Claude Code_: a host that can starts the
  task with its own `codex cloud exec` on the repository's base branch, in the
  Codex environment named for the repository, and keeps nothing. Unlike
  Claude Code's cloud, the host also follows it: the runner reads
  `codex cloud list --json` once a minute while a task it started is
  unsettled and reports it as the session's state (working, done, failed). The
  pane offers _Open in ChatGPT_ and `codex apply <id>`. Runner capability
  `session.cloud.codex`; hosts say `startsCodexCloudSessions`; the runner's
  `SESS_009` carries the CLI's own words when it refuses; `SESSIONS_038` now
  names either vendor.
- dc67559: Codex and Grok sessions get the chat view. The runner follows Codex's rollout
  (the newest one written in the session's directory since it was created) and
  Grok's ACP update stream (found by the session's id), and reads each as the
  transcript lines the chat already draws: commands as Bash, patches and diffs as
  edits with their lines, plans as the task list, a stopped turn as the
  interrupted note. Codex's token counts become the composer's context and plan
  meter. The chat names a model by the agent catalog's label.
- 731540f: Codex sessions start in a trusted folder, as Claude Code's already do: before
  a Codex launch the runner marks the session's folder, and the repository a
  worktree belongs to, `trust_level = "trusted"` in Codex's `config.toml`, so
  Codex no longer opens on "Trust this folder?". An answer already in the file
  is kept, the file's own text is kept with the new tables added at its end,
  and a symlinked config stays a symlink.
- 6eb8d65: Continue a Claude Code cloud session on a host. The cloud session's pane
  offers _Continue on a host_: pick a host and the console starts a worktree
  session there on the cloud session's repository whose agent runs
  `claude --teleport <id>`, then opens it. `POST /sessions` takes `teleport`
  (a cloud session id, with one checkout and no prompt); the launch keeps it
  (`launchTeleport`), so a re-sent create continues the same cloud session and
  a restart reopens it with `claude --continue`. The runner names the new
  capability `session.teleport`; a host whose runner does not is refused with
  `SESSIONS_048`. Claude Code names the teleported conversation itself, so the
  runner finds it as the newest transcript in the session's folder and keeps
  its name, which the chat view reads it by.
- d68e9c4: New session's folder picker searches the host by name
  (`product/versions/mvp/24-session-places.md` §4).

  - `@oppenheimer/shared`: the link gains `fs.find` and `fs.found` and the
    `fs.find` capability; `hostFolderSearchQuerySchema` is the endpoint's query.
  - `@oppenheimer/runner`: answers `fs.find` with a walk under home bounded by
    depth (4), directories read (20,000) and time (400 ms), that skips hidden
    directories and dependency trees and does not walk into git repositories.
  - `@oppenheimer/api`: `GET /v1/hosts/{id}/folders/search?q=`, refused as a
    listing of home is.
  - `@oppenheimer/api-client`: `searchHostFolders`.
  - `@oppenheimer/frontend-consumer`: `HostsRepository.searchFolders`,
    `useHostFolderSearch`, `HostFolderSearch`.
  - `@oppenheimer/web`: typing narrows the listed folder to names that hold
    what is typed, those that start with it first; `~billing` is read as
    `~/billing`; a bare name is searched for under home after typing pauses,
    and what is found shows under the listing; a search the host could not
    make says why there, except on a runner too old to search.
  - `@oppenheimer/translations`: `sessions.new.folder` gains `searchHeading`,
    `searching`, `searchTruncated` and `searchFailed`; `emptyFiltered` says
    "in its name".

- fda123f: A host's own desktop in the console: a Desktop tab beside a session and a Desktop page per host in Settings, watching until Take control, with Full screen. The host's owner shares it with `runner desktop on`; the runner signs in to the screen-sharing server on its loopback with credentials that stay on the host, and drops the browser's input until it takes control.
- c63402e: Answer a session's question or permission from anywhere but its terminal
  (the server half of the Inbox's slice 4, `29-inbox.md`).

  - `@oppenheimer/shared`: `SessionDecision` (a `question` from
    `AskUserQuestion`, or a `permission` dialog), the `agent.decision` payload,
    `answerSessionDecisionSchema`, and `@oppenheimer/shared/sessions` with
    `questionKeys`, `permissionKeys` and `QUESTION_KEY_GAP_MS`, moved from the
    console so the API types the same keys. The Go twin of the decision is
    generated (`emit-session-decision.cjs`).
  - `@oppenheimer/runner`: reports `agent.decision` when what a blocked agent
    waits on appears, changes or clears: the transcript's open
    `AskUserQuestion`, else Claude Code's permission dialog read off the
    screen.
  - `@oppenheimer/api`: folds it as `pendingDecision` (a new `jsonb` column),
    answers it on sessions as `decision`, and adds
    `POST /v1/sessions/:id/decision`, which types the answer into window 0 as
    `session.input` and records `decision.answered`. New codes `SESSIONS_032`
    (already answered or changed), `SESSIONS_033` (does not fit) and
    `SESSIONS_034` (host offline).
  - `@oppenheimer/api-client`: `answerSessionDecision`, and `decision` on
    `SessionResponseDto`.
  - `@oppenheimer/frontend-consumer`: the chat view imports `questionKeys`
    from `@oppenheimer/shared/sessions`.
  - `@oppenheimer/translations`: messages for `SESSIONS_032`–`SESSIONS_034`.

- 9b0c57f: OpenCode sessions get the chat view. The runner launches OpenCode serving its
  own API on a loopback port with a password of the session's, follows the
  conversation through it while a browser is attached, and sends each finished
  part as a line of the transcript the chat already reads, OpenCode's tools under
  the names the chat knows. The chat names the session's agent on its composer and
  empty state, and shows no context meter for a model whose window it cannot know.
- 3b5d381: Pi (`pi`) and Oh My Pi (`omp`) are agents a session can run. Both take a
  model as `provider/id` and a thinking level, reopen their conversation with
  `--continue`, and the runner installs them as the person: pi from npm, omp
  with Bun. Pi has no approvals, so its sessions show no permission chip; omp's
  three levels are its `--approval-mode` (`always-ask`, `write`, `yolo`). Both
  are terminal only for now, with no chat view.

  Settings → Agents chooses which agents New session's engine picker offers on
  this device, also reached from a gear at the end of the picker's strip. A
  fresh device offers Claude Code, Codex, OpenCode, Grok and the blank
  terminal; Pi and Oh My Pi are there to switch on. An agent switched off
  stays in the picker while a draft is on it.

- b11a949: A finished task ends with a recap: a bot woken because a session it follows completed ends its report with a recap of that session, and the note the runner writes for each session tells its agent to end every task it finishes with one.
- 1dbae54: A failed session start can be tried again. The start pane's **Try again**
  sends the host the same start, for the same session and with the same task
  (`POST /v1/sessions/{id}/retry`, `SESSIONS_052` for a session whose start did
  not fail), and draws the new attempt in place. A host whose Claude Code is not
  signed in to claude.ai refuses a cloud start with `SESS_019`, which the pane
  explains; the CLI's own words reach the console without its terminal escapes
  and with their spaces.
- 8b772b8: Agents run agents. From inside a session, `runner sessions run "task"`
  starts a child session (in the parent's folder by default, or a worktree of
  its own with `--repo`), `runner sessions send <id> "…"` types a message
  into one, `runner sessions wait` waits until every child has finished a
  turn, is blocked or ended, `runner sessions report "…"` sends the parent a
  message, and `runner sessions children` lists them with what each says.
  They go to the running daemon over its local socket.

  A parent hears in its own input, as `<oppenheimer from="…" state="…">`,
  when a child is blocked or through (`--quiet` turns that off); children end
  with their parent unless `--outlive-parent`. A message waits for its agent
  to be up (`SESS_012` after 30 s, which is usually a dialog for the person),
  is pasted, and is submitted after the agent's paste gap, so an agent that
  reads an Enter arriving with a paste as part of it still sends it.
  `HOST_012` is a command that found no runner on the socket.

  `runner --skill` prints the manual for an agent, every session's note
  points its agent at it, and every session's PATH has `runner` on it.

  - `@oppenheimer/shared`: the agent catalog's `input` (`submit`, `stop`,
    `pasteGapMs`), emitted into the runner's `launch_catalog.gen.go`.

- e4edace: A session on an empty repository starts: the runner pushes an empty first commit to the base branch and cuts the worktree from it, instead of failing with "couldn't find remote ref".
- 4117960: A host offers its sessions the simulators and emulators it has running, with
  no setup: with `RUNNER_DEVICES` unset, a session that asks for a device takes
  one of the iOS simulators simctl reports booted or the emulators adb sees,
  and the runner finds Argent's `simulator-server` beside the `argent` on its
  PATH and the tool-server Argent has running in `~/.argent`, read again on
  each input because Argent moves it. Before, a host that named no devices
  offered none, and the Simulator tab of every session said "No device".
  `RUNNER_DEVICES=off` offers none; naming devices works as before.
- 76b28d4: A kept session comes back on its own after the host reboots. `runner
sessions keep [<id>] [--off]` (or `runner sessions run --keep` for a child)
  marks it; when the runner starts on a host that booted after it last saved
  the session map, each kept session that was running is restarted once the
  refresh finds it stopped, which reopens its agent's conversation in the
  same checkout and never runs its first task again. A restart that fails is
  retried with herdr-core's backoff (1.5 s doubling to a minute, then every
  minute). A session whose agent exited, or that someone stopped or closed,
  stays as it was left.
- 48e1255: On macOS the runner ships as `OppenheimerRunner.app`, signed with a Developer
  ID and notarized, and runs from one fixed path, `~/.oppenheimer/bin/OppenheimerRunner.app`,
  which an update swaps in place. macOS keeps the runner's permissions
  (Documents, Desktop, network volumes, Full Disk Access, the local network)
  for the signed bundle, so a Mac no longer asks for them again after every
  update. A Mac a runner from before the bundle updated reinstalls its own
  version as the bundle at its next quiet moment. `selfupdate.UnpackTree`
  extracts a directory, such as the bundle, from a release archive.
- 8d59abf: Spotlight stops indexing a Mac host's sessions. A workspace's stores and
  sessions move to `repos.noindex/` and `sessions.noindex/` in the work folder
  (layout version 3): Spotlight skips a directory whose name ends in `.noindex`,
  where the `.metadata_never_index` marker at the root never kept it out, and on
  a host with a few sessions open `mdworker_shared` took more CPU than the agents.
  There is no migration: a running session keeps the folder it was made in, and a
  store left in `repos/` is cloned again on its next create. Delete the old
  `repos/` and `sessions/` directories by hand once their sessions are closed.
- 9a993ed: A session's agent now runs under `runner pty`, which speaks OSC 7501, the
  Program Status Protocol. Claude Code (2.1.295 and later) reports what it is
  doing only to a terminal that answers its `OSC 7501 ; ?` probe, and tmux
  answers none, so the wrapper sits between the agent and its pane: it
  answers the probe, keeps every report in a file under the runner's state
  directory, and passes every other byte through in both directions.

  The poll loop takes the agent's own word over the screen classifier while
  it holds one (`idle`, `working`, `done`, `blocked` with its kind, `error`
  read as `done`); the screen stays the fallback for agents that say nothing
  and the only source of a vendor login. `agent.observed` carries the report
  as an optional `program` object (`state`, `kind`, `progress`, `message`,
  `title`), and a new message on a session that stays blocked is published
  without restarting its blocked clock. Progress alone publishes nothing.

- cb449bb: WhatsApp replies can quote the message they answer: a `whatsapp.send` with
  `replyTo` goes out as an extended text naming the quoted message and its
  sender, inside the same host budget as any send. A sender or direct chat
  that arrives as a `@lid` id is reported by its phone number, from WhatsApp's
  alternative address or the device's LID map, so the owner a bot answers on
  WhatsApp is recognised however WhatsApp addresses them; an id whose number
  is not known yet keeps its `@lid`.
- aa92290: A session's chat queues what is written while the agent works and shows the room left. A message sent mid-turn waits on the composer (`SessionChat.post`), to be sent now, edited or dropped, and goes on its own when the turn ends, one at a time. Beside the model, the context meter opens to the context in tokens (with Compact) and the plan's 5-hour and weekly limits with their resets.

  The limits are Claude Code's own: the runner launches a session's Claude Code with `--settings` naming `runner statusline` as its status line, which keeps what the CLI hands it (`context_window`, `rate_limits`) by conversation and still draws the person's own status line, or `ctx · 5h · 7d` when they have none; the chat follower sends the latest as an `oppenheimer.status` entry (`ChatState.status`). The runner also keeps each answer's token counts (`message.usage`), so the context is counted off the transcript until the status line says. `ComposerContextMeter` forwards a button's props, so it can be a popover's trigger, and the composer's field is no longer remounted when something appears on top of it.

- ea93480: A Claude Code session read as a chat, a proof of concept behind
  `session_chat_view` (`product/next-steps/0.7-terminal-and-chat.md`).

  - `@oppenheimer/shared`: `attachment.chat` on the link (capability
    `attachment.chat`, `ChatEntryMaxBytes`, `ChatBatchMaxEntries`), `chat` on
    the attach socket, the `session_chat_view` release flag.
  - `@oppenheimer/runner`: while a browser is attached to a Claude Code
    session, the runner follows its transcript and sends each line compacted
    (no images, no thinking signatures, tool output and written files cut).
  - `@oppenheimer/api`: the relay hands `attachment.chat` to the attachment's
    browser, for a person the flag is on for and never through a share.
  - `@oppenheimer/frontend-consumer`: `SessionChat`, the entries read into
    turns of typed steps; `SessionStream.onChat`.
  - `@oppenheimer/web`: Terminal / Chat in a session's status bar; the chat
    draws turns, tool calls and the task list, and types into the PTY.
  - `@oppenheimer/design-system-web`: the `chat-ground` token.
  - `@oppenheimer/translations`: `sessions.chat.*`.

- 11fa44a: Deleting a session feels immediate, and a session gone from its host no
  longer gets stuck.

  - `@oppenheimer/frontend-consumer`, `@oppenheimer/web`: the sidebar drops a
    session the moment Delete is confirmed and keeps it out until its host
    resolves it. The row comes back when the close cannot happen: the API
    refuses it, the host is offline (`SESSIONS_CLIENT_019`, shown in the
    dialog), or the host has not resolved it within a minute. The "asked the
    host to delete" toast is gone. A restart's watch also ends when the
    session resolves.
  - `@oppenheimer/runner`: a close or a restart for a session this host holds
    no record of, one already closed here, or one whose worktree was deleted
    by hand closes it and reports `session.closed`, so its row resolves. A
    restart of such a session is still refused.
  - `@oppenheimer/translations`: `errors.byCode.SESSIONS_CLIENT_019`; the
    `toasts.sessionDeleteRequested` key is removed.

- 45d642b: A session runs in a new worktree or in a folder already on the host
  (`product/versions/mvp/24-session-places.md`).

  - `@oppenheimer/runner`: the work folder is `~/oppenheimer/<account>/<workspace>/{repos,
agents, sessions}`, with bare stores and a `.oppenheimer/` marker in every
    folder the runner makes; a folder session runs in the person's folder and
    writes nothing there; `fs.list` lists a host's directories. The old
    `~/oppenheimer-ai/workspaces` layout is not migrated.
  - `@oppenheimer/shared`: `session.create` carries the account and workspace
    ids and either checkouts or a `folder`; `fs.list` / `fs.listing`; the
    `session.folder` and `fs.list` capabilities; `createSessionSchema` takes a
    `folder` instead of checkouts.
  - `@oppenheimer/api`: `work_session` records the place and the folder;
    `GET /v1/hosts/{id}/folders` lists a folder through the runner with the
    caller's recent folders; `SESSIONS_025`–`031`.
  - `@oppenheimer/web`: New session's Where chip (New worktree, Folder on
    host), the folder picker, Open terminal on a host in Settings, folder and
    terminal icons in the sidebar. The permission level opens on `auto` and is
    remembered.
  - `@oppenheimer/design-system-web`: `Composer` takes `allowEmpty`, so a
    blank terminal can start with no first task.

- ec96195: A session's chat shows its subagents as they work. The runner follows each
  subagent's own conversation beside the session's (Claude Code's
  `subagents/agent-<id>.jsonl` and its meta, Codex's child rollouts by
  `parent_thread_id`, OpenCode's `task` conversations through its API) and
  sends its lines marked `isSidechain` with `agentId`, plus an
  `oppenheimer.subagent` entry naming the call that started it, its kind,
  model, state and tokens. A Codex subagent's rollout is no longer taken for
  the session's own conversation. The console puts each subagent into its
  call (`ChatToolCall.subagent`) and draws calls that started subagents as a
  `SubagentRunCard`, a row each with its task, kind, model, clock, current
  activity or outcome, calls and tokens; `SubagentRow` takes `children`,
  which the row's name folds.
- 1f7f57b: Sessions: read a session's conversation, and message coding agents both ways.

  - `GET /v1/sessions/{id}/transcript` (`sessions:read`) reads what a session's
    agent said and did, a page at a time off its host over the new
    `transcript.read` / `transcript.page` link messages, with an opaque cursor,
    secrets redacted, and a `status` (`complete`, `partial`, `unsupported`,
    `unavailable`) and `reason` on every page. A cloud session's conversation
    is `unsupported` with its vendor's link. Bots get `read_session_transcript`,
    MCP a tool of the same name, and `opp` `sessions transcript`.
  - A Cursor cloud session takes a follow-up prompt (`send_to_session`,
    `POST /v1/sessions/{id}/prompt`) as a new run of its agent, on its
    launcher's key, only once its last run ended (`CLOUD_AGENTS_012` while
    Cursor says it is busy, `SESSIONS_050` for anyone but the launcher).
  - An agent's `runner sessions notify` wakes every bot that follows its
    session, once per notice, the words fenced as the agent's.

- db4ae58: Bots can read and answer the chats of a Telegram bot the owner made with
  @BotFather, the way OpenClaw does it. The runner holds the bot's token on
  the host and long-polls the Bot API (no webhook, no public URL), pacing its
  sends to Telegram's limits and pausing on a `429`. `RUNNER_TELEGRAM=off`
  turns it off. The link gains the `telegram` capability and its `telegram.*`
  frames.

  The new `telegram` module keeps each bot (`telegram_account`, one per host)
  and the messages it receives (`telegram_message`, 90 days), behind
  `GET`/`POST /v1/telegram/accounts` and `DELETE /v1/telegram/accounts/:id`
  with the `telegram:read`/`telegram:write` scopes; the token crosses the
  control plane once and is never stored there. Bots get
  `list_telegram_accounts`, `list_telegram_chats`, `read_telegram_chat`,
  `search_telegram` and `send_telegram_message`, which asks unless the owner
  allowed it for that chat. Settings → Telegram connects and disconnects.

- 13374f0: A session's terminal can take a direct path to its host
  (`product/versions/mvp/22-direct-terminal-path.md`), behind the new
  `terminal_direct_path` release flag.

  - `@oppenheimer/runner`: answers a browser's WebRTC offer with pion and
    carries the attachment's bytes on one ordered `pty` data channel, at most
    eight per host; switches each direction at a byte offset; falls back to the
    link when the channel closes, with the tmux client repainted. The hello
    names `attachment.direct`.
  - `@oppenheimer/api`: the relay offers a direct path (with
    `RELAY_ICE_SERVERS`) to a runner that can answer, for a person the flag is
    on for, outside share links, and forwards the offer, answer, refusal and
    offsets.
  - `@oppenheimer/frontend-consumer`: the attach stream opens the data channel
    beside its socket when invited, switches at the offsets, follows a
    fallback, and stops trying after two failed channels; `onPath` says which
    path the bytes take.
  - `@oppenheimer/web`: the latency readout names the path.
  - `@oppenheimer/shared`: the signalling messages on both sockets, the
    `attachment.direct` capability and the `terminal_direct_path` flag.

- 5b1c52a: Bots can read and write in the owner's WhatsApp, the way OpenClaw does it.
  The runner pairs a spare number as a WhatsApp linked device (a QR code
  scanned from the phone) and keeps its keys on the host; it is never shown
  online, syncs no history, sends no read receipts and keeps a send budget of
  its own. `RUNNER_WHATSAPP=off` turns it off. The link gains the `whatsapp`
  capability and its `whatsapp.*` frames.

  The new `whatsapp` module keeps each number (`whatsapp_account`, one per
  host) and the messages it sees (`whatsapp_message`, 90 days), behind
  `GET`/`POST /v1/whatsapp/accounts` and `DELETE /v1/whatsapp/accounts/:id`
  with the `whatsapp:read`/`whatsapp:write` scopes. Bots get
  `list_whatsapp_accounts`, `list_whatsapp_chats`, `read_whatsapp_chat`,
  `search_whatsapp` and `send_whatsapp_message`, which asks unless the owner
  allowed it for that chat. Settings → WhatsApp links, pairs and unlinks.

### Patch Changes

- 2128771: A session chat's history says where it ends. The runner marks each batch of a history `more` until the one that reaches the transcript's end, `end`; the API relays it, and the console holds a first load until it is told, instead of guessing from the batches' size and pace. A chat full of screenshots, whose reads the runner slows making previews, is drawn once, at its end, not once per read on its way down.
- 8a8749d: A prompt reads as the person typed it. Pasted text no longer shows the
  `<pasted_content>` tags Claude Code wraps it in, and system reminders the CLI
  adds before or after the words are left out. This applies to the session chat
  and to the first message the runner reports. A message that opens with a
  reminder is no longer dropped from the chat.
- d3385f5: A Claude Code cloud start leaves nothing on the host: the runner stops the CLI's whole process group, not only `claude` itself, forgets the scratch checkout in Claude Code's state (`~/.claude.json`, `projects/`), and deletes scratch checkouts a stopped runner left behind.
- e0d1b77: Cloud starts work again with Claude Code 2.1.31x, which asks once per machine
  "Use this machine's settings in cloud sessions?" before `claude --cloud`
  creates a session. Unanswered, the question held every start the runner made
  until it timed out. The runner now answers it with "No, keep them on this
  machine" (what cloud sessions did before the question existed) when the
  person has not answered it, never overwrites an answer they gave, and fails
  a start at once, saying how to answer, if the question still shows.
- e654055: A Codex session's chat stays on the person's own conversation. Codex 0.167
  writes threads of its own in the session's directory (an approval's guardian
  review, a compaction, a memory consolidation, an attached fork), and the chat
  used to follow whichever rollout was newest. It then showed one turn with no
  prompt and nothing typed after it. The runner now picks a rollout the way
  `codex resume` does.
- f6a81a2: Codex cloud sessions start on Codex's current cloud: in Codex's default
  environment with the repository, or in an environment id pasted from ChatGPT
  Settings → Codex Cloud. The environment picker no longer asks the host for a
  list of legacy environments (`GET /v1/hosts/:id/codex-environments` and its
  codes `SESSIONS_044`–`047` and `055` are gone); it offers Default and the id
  you paste. A host whose codex is not signed in to ChatGPT refuses the start
  with `SESS_022`.
- 7a8851a: A Codex cloud start whose environment the CLI cannot find is its own refusal,
  `SESS_010`, instead of the CLI's bare "not found". codex-cli resolves `--env`
  only against the environments `codex cloud` lists; the ones made in ChatGPT
  Settings → Codex Cloud are not reachable by it yet. The detail names the labels
  tried and the environment labels on the account's recent tasks (a partial list:
  the CLI lists environments only in its TUI), and the failed start's pane
  explains it in English and Spanish with a link to Codex Cloud settings.
- bef5144: A Codex session shows the person's prompts again. The runner reads what
  was typed from the `UserMessage` an `item_completed` finishes, which is
  where Codex 0.167 writes it since it stopped writing `user_message` to the
  rollout, so the Chat tab no longer opens on the reply alone. In the
  terminal, Codex's grey prompt block (the `›` row, its padding and image
  labels) is drawn as the same bubble as a Claude Code prompt rather than a
  bright slab.
- 6bb3a80: OpenCode's catalogue offers z.ai's GLM: GLM-5.3, GLM-5.3 Highspeed and GLM-5.3
  Flash under `zai-coding-plan/`, OpenCode's provider for the GLM Coding Plan,
  each with the low, high and max levels OpenCode offers for it.
- a3cf769: OpenCode's catalogue offers DeepSeek (V4 Pro, V4.1 Flash), Moonshot's Kimi
  (K3.1 Pro, K2.7 Code), Alibaba's Qwen (3.8 Max, 3.8 Flash) and MiniMax (M3.1
  Flash), each with the effort levels OpenCode offers for it.
- 95a808f: A session cut from a base branch with a slash in its name (`claude/x`) starts:
  the base is read from the store's `refs/remotes/origin/`, where it was
  fetched, instead of being passed to git as if it were already a full ref,
  which failed with "Not a valid object name" or put the worktree on a copy of
  the base rather than on the session's own branch.
- f3108f4: An agent still blocked 15 s after it was announced is announced once more. The control plane counts how long a state lasts only from its second report, so a session whose agent asked a question was never marked as waiting on you, in the sidebar or the Inbox.
- c4289b6: A Claude Code session back at its empty prompt after a turn is read as idle again. Claude Code 2.1 draws the prompt as `❯` and a no-break space, which the manifest's prompt rule did not match, so the session read `unknown`, its turn never completed, and a bot that sent a follow-up never heard it finish.
- c28dd80: A Claude Code session showing a suggested next prompt after a turn is read as idle. Claude Code 2.1 puts the suggestion in the input box, which the prompt rule only recognised when empty, so those sessions still read `unknown` and their turns never completed.
- bb3f005: The runner image builds again: it no longer copies `go.work`, which lists Go modules the image does not carry (`e2e/netsim`), and builds with `GOWORK=off` on the module's own `replace` directives.
- 87f7a89: `runner uninstall` no longer reports success when the control plane did not unpair the host: it still erases the identity, but prints the underlying failure (request, status, the control plane's reason) and how to finish — Remove under Settings → Hosts, or `DELETE /api/v1/hosts/{id}` with an API token — and exits 7 with `PAIR_009`. A refused revocation is `PAIR_008` rather than a registration-token error. `register` on a host that is already paired names both control planes and the `uninstall` / `register --force` commands that move it.
- 8f24bca: A session's chat is there as soon as its terminal attaches. The runner's
  first word on a conversation with nothing written yet went as
  `entries: null`, which the control plane refuses, so the chat was not
  offered until the agent's first line; it now goes as an empty list. The
  session's placeholder is the pane's own ground instead of a grey slab.
- 2d187ed: Update a host's runner from the console: **Update runner** in a host card's
  menu on Settings → Hosts (09 §5, "Manual control").

  - `@oppenheimer/api`: `POST /v1/hosts/{id}/update` sends `host.update` down
    the host's link, through the links module's registry, and answers `202`.
    A host with no live link is `HOSTS_008` (409).
  - `@oppenheimer/shared`: `host.update`'s `version` is optional. Absent, the
    runner installs the newest release on its channel and stays unpinned (a
    pinned host refuses); present, it pins, as before.
  - `@oppenheimer/runner`: the generated `HostUpdate` omits an empty `version`,
    and a versionless `host.update` respects a pin (`ApplyOptions.KeepPin`):
    it skips the safe window, but a pinned host refuses with `UPD_004`.
  - `@oppenheimer/api-client`: `updateHostRunner`.
  - `@oppenheimer/frontend-consumer`: `HostsRepository.updateRunner` and
    `useUpdateHostRunner`.
  - `@oppenheimer/web`: the menu item, off while the host is offline, opens a
    confirm (`UpdateRunnerDialog`) that says what the restart does; a
    `hostUpdateRequested` toast on success, and a refusal kept in the dialog.
  - `@oppenheimer/frontend-web`: `ConfirmDialog` takes `tone="primary"` for a
    confirm that loses nothing; `destructive` stays the default.
  - `@oppenheimer/translations`: `hosts.settings.updateRunner`, `updateTitle`,
    `updateDescription`, `updating`, `updateFailed` and
    `toasts.hostUpdateRequested`.
  - `@oppenheimer/docs`: `HOSTS_008` in the error catalog.

- cac2a74: WhatsApp pairing no longer fails with `err-client-outdated`: the runner is on a current whatsmeow (Go 1.26), sends WhatsApp Web's current version in the handshake, fetched before every pairing and connection, and when WhatsApp refuses a linked device as outdated later, fetches the version again and reconnects.
- 4ee069d: Lay the ground for a bot answering its owner on WhatsApp
  (`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3),
  with Telegram answering exactly as before.

  - `@oppenheimer/api`: the `AnswerOnWhatsapp` migration gives a linked
    number its default bot (`answeringBotId`) and its owner's number and
    pending code, gives each stored WhatsApp message the order it was stored
    in (`seq`), the bot a "Name: …" switched to and whether it was the bot's
    reply, and lets a bot conversation and a turn be WhatsApp's. The pieces of
    bots-chat that were Telegram's now work for any channel: a channel's chat
    (`findChannelChat`), the conversation a message starts, Clear history,
    whether a turn can still answer, the turn-context line, an ask's answer,
    and one `deliver-channel-reply` job, which the worker also takes under the
    old `deliver-telegram-reply` name for one release. Deleting a bot that is
    a WhatsApp number's default answers `BOTS_043`.
  - `@oppenheimer/shared`: `whatsapp` is a turn origin (`BOT_CHANNEL_ORIGINS`,
    `isChannelOrigin`); the WhatsApp account carries `answeringBotId`,
    `ownerNumber`, `ownerPendingNumber` and `ownerCodeExpiresAt`, with the
    update, owner and confirm schemas; `whatsapp.send` takes an optional
    `replyTo` to quote, which an older runner ignores; `splitReplyText` cuts a
    reply for any channel.
  - `@oppenheimer/api-client`: `deleteBot` documents `BOTS_043`.
  - `@oppenheimer/translations`: `errors.byCode.BOTS_043`.
  - `@oppenheimer/runner`: the generated link vocabulary carries
    `whatsapp.send`'s `replyTo`, which the runner quotes from.

## 0.2.0

### Minor Changes

- 27af598: The agent catalog gains an `update` argv (the CLI's unattended updater), and the
  runner keeps installed agent CLIs current with it (`runner agents update` by
  hand). Claude Code and OpenCode seed Claude Sonnet 5.5 (`claude-sonnet-5-5`) in
  place of Sonnet 5.
- a880b19: Connecting a host is hardened. An unpaired host is refused a link and stops dialling. The pairing-token cap holds under concurrent mints, and `POST /v1/hosts/pairing` takes `replaces` to retire the token on screen in the same write. The owner is emailed when a machine pairs. The agent prompt is a short template around the install command. `runner uninstall --force` keeps the pairing when a session cannot be ended, and a re-run of the installer restarts the systemd unit on the new release.
- 09cea4c: Effort is each CLI's own levels, per model, instead of five product stops.

  - `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
  - `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
  - `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
  - `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
  - `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.

- fc0e75d: The hosts backend for the Settings page (`product/versions/mvp/14-hosts-settings.md`).

  - `@oppenheimer/api`: a host read carries a derived `status` (`running`, `idle`,
    `offline`, `unpaired`) and `runningSessionCount`, counted by `sessions/`
    through `HostsModule.contributeUsage`. `GET /v1/hosts` leaves unpaired hosts
    out unless `include=unpaired`. Removing a host, from either end, stops the
    sessions running on it. New `GET /v1/hosts/pairing/{id}` returns the token and
    the host it paired, for Add host's "Listening for this host…".
  - `@oppenheimer/shared`: `HOST_STATUSES`, `listHostsQuerySchema`, and an
    optional `cpus` on the host facts, on both Zod entry points.
  - `@oppenheimer/api-client`: regenerated; `getPairingToken`,
    `PairingTokenStatusResponseDto`, `HostStatus`.
  - `@oppenheimer/runner`: the facts report the logical CPU count as `cpus`.
  - `@oppenheimer/api`: host metadata tables (`host_inventory`, `host_presence`,
    `host_network`, `host_event`), backfilled from `host`; the old columns stay
    until the code switches over (`product/versions/mvp/15-host-metadata.md`).
  - `@oppenheimer/api`: heartbeats write `host_presence` and, only when the
    machine changed, `host_inventory`, with the change on the host's timeline;
    host responses carry `machine`, `vitals` and `network`;
    `GET /v1/hosts/{id}/timeline`. The network a runner connects from is
    recorded and placed with DB-IP Lite (`HOSTS_GEOIP_CITY_DB`,
    `HOSTS_GEOIP_ASN_DB`, the `ip_geolocation` capability); a move to another
    country or network operator emails the owner. A daily job purges networks
    unseen for 90 days and timeline entries past 180.
  - `@oppenheimer/runner`: reports OS name, kernel, CPU model, memory, disk
    total, virtualization, cloud, time zone, boot time and service manager,
    and available memory on the heartbeat.
  - `@oppenheimer/backend-email`: `sendHostNetworkChanged` and its template.
  - `@oppenheimer/translations`: `emails.hostNetworkChanged`.

- 2202daa: A session's first task can carry images.

  - `@oppenheimer/shared`: `session.create` carries `images` for runners that name `session.create.images`; `POST /sessions` takes `attachmentIds`.
  - `@oppenheimer/api`: `POST /v1/sessions/attachments` stages an image for the create that names it.
  - `@oppenheimer/runner`: pulls a create's images and names their paths to the agent with the task.
  - `@oppenheimer/frontend-consumer`: `useUploadSessionAttachment`.
  - `@oppenheimer/web`, `@oppenheimer/translations`: the paperclip and paste attach images to the first task.

- e505b9e: A host gets the repository ready while New session is still being written:
  picking a host and a repository sends `repository.prepare`
  (`POST /v1/sessions/prepare`), and the host clones or fetches it and builds a
  spare worktree, so the create that follows starts in about a second. A first
  clone is shallow and deepened in the background, checkouts write from one
  worker per core, and session branches are cut `--no-track`.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- df6d451: A repository's store is a blobless clone with no working tree. A session create fetches only the branch its worktree is made from, with no tags and no automatic gc, and takes a spare worktree the runner checked out ahead of it.
- bb3c4e8: The runner logs each step of starting a session as `session.step`, with the time each took, and resends unacknowledged batches in the order it made them.
- b2fd6a1: A session takes files, not only images: PNG, JPEG, GIF and WebP as before,
  plus PDF and UTF-8 text (plain, Markdown, CSV, JSON, code, logs), pasted,
  dropped or attached to the first task. Every file is judged by its bytes at
  the API and again on the host: executables, archives, scripts with a `#!`
  line, SVG and HTML are refused whatever they are called, and the runner
  names each file itself. A runner announces the wider set with the
  `session.files` capability; an older one is still sent images only.
- a566fac: A session's start says when the host is downloading the repository for the
  first time: the clone step carries `download`, and the start pane explains
  the longer wait.
- 3404cd3: A session's terminal can be shared with a link, to watch or to type, for anyone, any signed-in account or named people (`product/versions/mvp/21-session-share-links.md`).

### Patch Changes

- da32bb1: One exec helper and one WebSocket writer pump for the Go services.

  - `@oppenheimer/go-execx` (new): `execx.Run(ctx, Spec{Name, Args, Dir, Env,
Timeout, KillGroup, WaitDelay, Output})` runs a command to completion,
    returns its output on failure too, reports `TimedOut` / `Canceled`, kills
    the process group on cancel when asked, and bounds the wait for output a
    child left open (`DefaultWaitDelay`, 5 s).
  - `@oppenheimer/go-ws`: `Pump` / `PumpChan` are the one writer for a socket,
    with pings between frames on a busy one; the hub's connections use
    `PumpChan`. Validation replies use `problem.ErrValidation.Code` rather than
    a copy of `RUNNER_001` (same value on the wire).
  - `@oppenheimer/runner`: tmux, git, systemd, launchd, the host probes and the
    staged binary's selfcheck run through `execx` with unchanged timeouts,
    output and error text; every one of them now stops waiting for output a
    leftover child holds open. The control-plane link writes through `ws.Pump`.

- 88f7898: Generate the runner's link protocol from the shared schema instead of keeping a hand-written Go twin. Wire-neutral: the same bytes on the wire before and after.

  - Shared: `RUNNER_LINK_REFUSAL_HEADER`, `RUNNER_LINK_REFUSALS`, `LINK_FRAME_HEADER_BYTES` and `ATTACHMENT_CREDIT_WINDOW_BYTES` join the close codes in `protocol/link.ts`, and the schema artifact carries every link constant under `x-constants`. The build also writes `protocol-schema/samples.json` (one message of every type, from the build-only `src/protocol/samples.ts`) and, through the new `scripts/emit-link-protocol.cjs`, `apps/runner/internal/link/protocol.gen.go`. Requiring an emitter no longer rewrites its output, so the committed-file specs can fail; `check:generated` runs every emitter's `--check`.
  - Runner: `link/protocol.go` keeps only what is not wire shape; the structs, the type names and the constants are generated. `link/protocol_test.go` decodes every TypeScript sample with `DisallowUnknownFields`, holds each struct and the host's `Facts`/`Tool` to the schema, and checks the constants and gofmt. The lifecycle commands decode into their own messages rather than one merged struct. The package now declares `@oppenheimer/shared`, so a shared-only change runs the Go job.
  - API: the refusal header, the `host-unpaired` refusal and the frame header width come from `@oppenheimer/shared/protocol`.

- e717f42: Harden the runner link. PTY bytes are no longer dropped when a queue fills,
  and the runner's writer sends control frames first, then takes attachments in
  turn, so one pane's output no longer delays another pane's echo. Both sides
  now ping every 15 s, a runner the control plane cannot write to is closed
  rather than skipped, and epochs keep rising across API restarts. The
  terminal's transport (`SessionStream`, the resize coalescer, the replay
  stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
  `SessionsService.openStream` and `useSessionStream`.
- 6b943c3: Removing a host stops its sessions on the machine, as the remove dialog says.
- 38b511f: Restart brings a session back where it left off, and the stopped pane says so.

  A restart recreated window 0 and started the agent from nothing, replaying the
  first task — so the conversation was lost and the work asked for twice. Now
  that a session names the agent's own conversation, a restart reopens it
  instead: same worktree, same branch, the whole exchange back, and no prompt
  re-sent because the conversation already holds it. Grok joins Claude Code;
  Codex and OpenCode can only resume an id they chose themselves, so they keep
  restarting the way they did.

  The pane that said "This session has stopped. Its work is on its branch" now
  names the branch, says restarting brings the terminal back where it left off,
  and leads with **Restart**. A deleted session has no worktree to return to, so
  it is offered nothing.

- 7f94a9d: Close pushes the session branch with that session's GitHub credential.
- eee2b40: Keep the link's read loop responsive and serialise updates.

  - `host.update` and `host.preflight` run off the read loop, each on a lane of its own and on the daemon's context, so **Update now** on a slow connection no longer stops the pongs, drops the link and cancels its own download. A preflight collects the host once, not twice.
  - A browser's keystrokes go to a bounded queue per attachment that one goroutine writes to the PTY; a wedged `tmux attach` client closes its own attachment (`attachment.closed`, "input stalled") instead of stalling the link.
  - `session.resize` for an open attachment is applied inline, not behind the session's lane; one for an attachment still opening keeps its place behind the attach.
  - An attach whose PTY opens after its link dropped is closed rather than streamed on the next link under an id that link may have given someone else.
  - `Updates.Apply` and `Rollback` run one at a time in the process, and staging uses unique file names, so the periodic check, **Update now** and `runner update` never download into the same file.
  - Event batches refused with backpressure while the link stays up are retried every 5 s in order, a flush stops at the first refusal, and at most 4096 batches wait (the oldest is dropped with a warning).

- 81f0347: A session on a private repository clones, and a create survives the link dropping while it runs.
- e3975db: `runner run` makes its home and `run/` directories private before it opens the
  control socket: a directory left looser than `0700` (created by hand, by an
  older version, or restored from a backup) is tightened, and a symlinked one, or
  one another account owns, is refused with `HOST_008`. That closes the window
  between the socket's `Listen` and its `Chmod 0600`, in which the socket that
  hands out installation tokens had the process umask's permissions.
- c4e3622: A refresh no longer overwrites a stop or a close, and polling costs less.

  - A session refresh is a compare-and-set: it is dropped when a command wrote
    the session while it looked, or is still working on it, and it never moves
    a session out of `stopped` or `closed`. A close that raced a refresh no
    longer comes back as `working` and then `stopped`, so the console no longer
    shows a second `session.stopped` after a close or an ordered stop.
  - The session map is written only when a session changed; a quiet poll writes
    nothing.
  - The poll loop lists the tmux server once per tick (`list-panes -a`) and runs
    one `capture-pane` per live session, instead of `has-session`,
    `capture-pane` and `display-message` for each.
  - Tool versions and the macOS version are cached per executable (path, mtime,
    size) with a 10-minute backstop; a preflight probes afresh.
  - Concurrent credential-helper calls for one session share a single
    `credentials.token` ask, and one caller giving up does not fail the others.

- 5b93fd7: Runner review follow-ups. `systemctl`, `loginctl` and `launchctl` calls now time out after a minute. `runner sessions` refreshes the whole host in one pass. An event batch the link took but never acked is sent again after a minute, together with every batch made after it, in order. The link has one frame cap, `LINK_MAX_FRAME_BYTES` (512 KiB), shared by the control plane and the generated `MaxFrameBytes`: the runner reads nothing larger and never sends anything larger. When the session list in `hello` and `heartbeat` does not fit, it is sent compact, and only past about 2,800 sessions is it truncated.
- 12b89c7: **Upgrade note:** a runner home that is a symlink is now refused. `runner run`
  stops with `HOST_008` ("The runner's own directory is not safe to use") when
  `~/.oppenheimer` (or `RUNNER_HOME`), or the `run/` directory under it, is a
  symlink, where earlier versions followed it. A host whose home was moved to
  another disk and linked back stops coming online after this update, and its
  service keeps restarting into the refusal. Put the real directory back in
  place (`target="$(readlink -f ~/.oppenheimer)" && rm ~/.oppenheimer && mv
"$target" ~/.oppenheimer`) or install again with `RUNNER_HOME` set to the real
  path, then restart the service. The error reference's runner section
  (`apps/docs/docs/errors.md#host_008`) has the steps.
- 020f0df: Sessions stop handing the host's CPU to Spotlight, and launch on a plausible
  terminal.

  - **The workspace root is kept out of the desktop search index.** A session is
    a worktree with its dependencies installed, so a host running a few of them
    holds several complete copies of a repository — gigabytes across hundreds of
    `node_modules` directories, rewritten whenever an agent installs something.
    macOS indexed all of it: on a host with eight sessions open,
    `mdworker_shared` took more CPU than the agents, `tmux list-panes` passed its
    ten-second deadline, and the control-plane link missed its pings, so the
    terminals in the browser went blank. The runner now writes
    `.metadata_never_index` at the workspace root, both when a root is chosen and
    on every boot, so an existing pairing gets it without re-pairing. Deleting
    the file turns indexing back on.
  - **A detached session launches at 132x40 rather than tmux's 80x24.** An agent
    lays its turn out for the terminal it is told about, so a session created and
    left alone — every session between "send" and the reader opening it, and
    every session an automation runs — did its work in 80 columns and then
    reflowed into the console's ~130 when someone finally looked. `window-size
latest` still hands the window to a real viewport the moment one attaches.

- c2288fb: A new session opens on its agent. The runner starts the agent in place of the
  pane's shell (`tmux respawn-pane`) instead of typing the line that starts it,
  and the console keeps the start's steps on screen until the agent step lands.
- 8f5fd3d: A session names the agent's own conversation, so a stopped session can be
  reopened instead of read back.

  These CLIs already keep the transcript — the catalog's `transcriptLocation` is
  where — so nothing said in a session was ever lost. What was missing was a name
  both sides agree on: the CLI picked its own id and told nobody, so the only way
  back to a conversation was the tmux pane, which dies with the session. A run
  stopped by the hour limit left a console screen saying "This session has
  stopped" and nothing else, which for an automation run is the whole result.

  The launch now carries `conversation`, the session's own id, and the catalog
  says per agent how to pin it and how to reopen it — `--session-id` and
  `--resume` for Claude Code. An agent whose CLI cannot be told an id, or that
  keeps no transcript at all (the blank terminal), is sent nothing.

  Verified end to end: a session created, answered, its tmux session destroyed,
  and `--resume` in the same worktree brought back the whole conversation, live
  and ready for a follow-up.
