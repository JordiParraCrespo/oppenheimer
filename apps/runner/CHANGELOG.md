# @oppenheimer/runner

## 0.3.0

### Minor Changes

- 6bc01b2: A bot turns a host's switches on when the person asks, instead of telling
  them to run `runner browser on` on the host.

  - `@oppenheimer/shared`: the link gains `host.settings.set` and
    `host.settings`, gated on the `host.settings` capability, with
    `HOST_EXEC_MODES`, `HOST_SWITCH_STATES` and `HOST_EXEC_ALLOW_MAX`.
  - `@oppenheimer/runner`: answers `host.settings.set` by writing the files
    `runner browser`, `runner computer` and `runner exec` write; a bad
    allowlist entry changes nothing (`EXEC_008`).
  - `@oppenheimer/api`: bots get `set_host_settings`, offered only on the
    owner's own turns and one card per call under Approve for me; the
    browser, computer, exec and terminal refusals point the bot at it.

- fd6277d: Antigravity (Google's `agy`) is an agent a session can run, with Gemini 4
  Neon, Carbon, Argon and Hydrogen, Gemini 3.8 Flash, and Antigravity's Claude
  Opus 5.5 and Sonnet 5.5. Its three permission levels are `--mode default`,
  `--mode accept-edits` and `--dangerously-skip-permissions`; the effort is
  `--effort`, the first task `--prompt-interactive`, and a stopped session
  reopens its conversation with `--continue`. `runner agents install
antigravity` installs `agy` from Google's release, checked against the
  manifest's SHA-512; agy keeps itself current. Terminal only for now, with no
  chat view, and switched on in Settings → Agents.
- a2d35a8: A bot can drive a browser of its own on a host. `use_browser` does one thing
  (open an address, read the page, click or type by an element's ref, press
  keys, scroll, go back, wait, close) and returns the page: its title and
  address and everything on it that can be acted on, each with a ref. A model
  that reads images also gets a picture of the page; one that does not browses
  by text.

  The host decides: nothing happens until the person there runs `runner
browser on` (`runner browser` shows the setting and the browser a bot would
  get). The runner starts the host's Chrome, Chromium or Edge headless, one per
  bot with a profile of its own, and drives it over the DevTools protocol.

  On the link this is `browser.act` / `browser.page`, gated on the new
  `browser.use` capability. Refusals are `BROWSER_001` (off on the host),
  `BROWSER_002` (no browser installed), `BROWSER_003` (the action does not fit
  the page), `BROWSER_004` (the browser or the page failed) and `BROWSER_005`
  (the setting cannot be read).

- 172b7ab: A bot can use a computer on a host. `use_computer` does one thing on the
  host's screen (look, click, double-click, right-click, drag, scroll, type,
  press keys, wait) and returns a picture of the screen after it, which the
  bot's model reads before its next step.

  The host decides: nothing happens until the person there runs `runner
computer on` (`runner computer` shows the setting and the screen a bot would
  get). A Mac's main display is driven through `screencapture` and `osascript`
  and needs Screen Recording and Accessibility; a Debian or Ubuntu host needs
  `xdotool`, ImageMagick and `xauth`, and gets a virtual screen (Xvfb) when it
  has no display; a Wayland session is refused.

  On the link this is `computer.act` / `computer.screen`, gated on the new
  `computer.use` capability. Refusals are `COMPUTER_001` (off on the host),
  `COMPUTER_002` (no screen the runner can use), `COMPUTER_003` (the action
  does not fit), `COMPUTER_004` (the screen could not be read or used) and
  `COMPUTER_005` (the setting cannot be read). A bot tool's answer can now
  carry images to the model, through both engines.

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
- 24ca7aa: Bots react on Slack and WhatsApp: the `react` tool, which refused outside the console chat, now puts the bot's chosen emoji on the owner's message that opened its turn, on Slack as the bot's app (by Slack's name for it; 👀 stays the working sign) and on WhatsApp as the number, over the new `whatsapp.react` frame (capability `whatsapp.react`), spending the host's send budget. It asks nothing, as the reply in that chat does, and is kept in the console only once the channel took it. Telegram still takes none.
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
  it is idle (`product/design/sessions/cloud-agents.md`, "Waking an idle session").

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

- cd41613: Codex and OpenCode sessions now say when they wait on you. Their detection rules were rewritten from the real CLIs' screens (Codex 0.171, OpenCode 1.19.6): Codex's approval and Plan-mode question, and every OpenCode permission, read as blocked instead of working or unknown. A block is confirmed 3 s after the runner sees it, not 15 s.
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
- b48571f: Every agent a session starts knows Oppenheimer. `runner mcp` serves the session commands (start and message other agents, notify, send a file, wake on a pull request or later) as MCP tools, and the runner hands it to Claude Code, Codex and OpenCode at launch, beside the person's own servers. Codex is told where the session note is and OpenCode reads it, which neither did before: both stop looking at the checkout, below the session's folder.
- d68e9c4: New session's folder picker searches the host by name
  (`product/design/sessions/session-places.md` §4).

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

- d577bfe: fx, Vercel Labs' coding agent (`fx`), is an agent a session can run. It takes
  a model as a Vercel AI Gateway id (`spacexai/grok-4.7` by default), an effort
  with `--effort`, and the three permission levels as its own
  `--permission-mode ask|auto|full-access`; a stopped session reopens its
  conversation with `--continue`. The runner installs it from its GitHub
  release, checked against the release's `.sha256`, into `~/.local/bin`, and
  keeps it current with `fx upgrade`. Terminal only for now, with no chat view.
  Settings → Agents lists it, off on a fresh device, as Pi and Oh My Pi are.
- 3e1fa7d: A view-only guest on a shared session can scroll its terminal back. Its
  wheel never reaches tmux (a read-only client), and tmux's copy mode is the
  pane's, so scrolling there would move the owner's view: the guest's first
  notch up asks the host for the pane's scrollback instead (`history.ask` on
  the attach socket, `attachment.history` on the link, capability
  `attachment.history`), read with `capture-pane -e` (up to 5,000 lines, its
  last 384 KiB), and the console draws it over the live grid with its
  colours. Scrolling to its end, Escape or Back to live returns to the live
  pane, which never stopped following.
- af020b8: Hermes (`hermes`, Nous Research's agent) is an agent a session can run. It
  starts as `hermes chat` with the first task as `--query`, which on a terminal
  seeds an interactive session, and reopens its conversation with `--continue`.
  It runs the model and approvals its own configuration names (`hermes model`,
  `approvals.mode`), so the picker offers no model, effort or permission chip
  for it, and the runner keeps it current with `hermes update --yes` but does
  not install it: Nous's only installer is a piped script nothing checks.
  Settings → Agents lists it, off on a fresh device, with its mark.

  A Hermes session has a Chat view. Hermes keeps its conversations in SQLite
  (`$HERMES_HOME/state.db`) rather than a transcript file, so the runner reads
  the newest CLI conversation Hermes started in the session's directory since
  the session was created, read only: its prompt, thoughts, tool calls (its
  `terminal`, file and patch tools as Bash, Read, Write and Edit) and replies,
  live, back across a compaction, and starting over on an undo. Bots and `opp`
  read it a page at a time.

- fda123f: A host's own desktop in the console: a Desktop tab beside a session and a Desktop page per host in Settings, watching until Take control, with Full screen. The host's owner shares it with `runner desktop on`; the runner signs in to the screen-sharing server on its loopback with credentials that stay on the host, and drops the browser's input until it takes control.
- a74c86a: A watched desktop shows the host's pointer. Apple's Screen Sharing never says where its pointer is, so on a Mac the runner reads it with CoreGraphics and sends `desktop.pointer` while the reader watches (about thirty a second, only when it moves); the relay forwards it as a `pointer` frame, and the console's Desktop viewer draws the host's own cursor shape there, scaled with the screen. Nothing is drawn while the reader is in control.
- 4fefacd: Idle sessions free their memory on their own, and coming back to one is
  opening it.

  - `@oppenheimer/runner`: every 5 minutes, the daemon stops each session whose
    agent has been `done` or `idle` for 2 hours, with no terminal attached and
    nothing typed into it. It stops and never closes, on the same path as Stop:
    the agent's processes go, and the checkout, branch and conversation stay.
    It looks at the agent afresh before each stop. It never stops a working or
    blocked agent, a session with a second agent in another window, an
    attached session (a console
    attach, or a tmux client on the host), a kept session, a child whose parent
    is live, or a parent with a child that is not idle too. Each stop is
    logged ("stopped an idle session"). `RUNNER_IDLE_STOP` sets the window (a Go
    duration) or turns it `off`, and the service unit carries it.
  - `@oppenheimer/web`: opening a stopped session as its owner restarts it,
    showing Restarting until the terminal is back, when its host is online. A
    restart that fails, or that the host does not bring back within a minute,
    falls back to the stopped pane with Restart and the reason (the Restart
    button now waits for the terminal the same way). A sidebar row, a hovered
    link, a route preload, a shared view, a deleted session and an offline
    host restart nothing, nor does a session that stops while its page is open,
    or one shown in another session's side pane.
  - `@oppenheimer/frontend-consumer`: `RESTART_WATCH_MS` is exported, so the
    pane gives up when the restart watch does.

- c63402e: Answer a session's question or permission from anywhere but its terminal
  (the server half of the Inbox's slice 4, `inbox.md`).

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

- d2644b5: Muse (Meta's Muse Code, `muse`) is an agent a session can run. It offers
  Muse Spark 1.3, Muse Spark 1.2 (its default) and Muse Ember 1.0, each with
  `--reasoning-effort` from minimal to ultra, and its three permission levels
  are `--approval-mode untrusted`, `--approval-mode on-request` and `--yolo`.
  `runner agents install muse` installs its launcher, refusing one whose
  response carries no checksum, and the launcher fetches the native binary
  against its release manifest's SHA-256 and keeps it current itself.

  Muse is off in Settings → Agents until switched on, terminal only, and takes
  no task on the command line: New session starts it without one, as it does
  the blank terminal, and the person types the first task in its terminal; a
  restarted session opens a fresh Muse; automations do not offer it, and a bot
  asked to start one is told to pick another agent.

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

- 0b173cc: Qwen Code (`qwen`, `@qwen-code/qwen-code`) is an agent a session can run, with
  a Chat view. It offers Qwen3.8 Max (its default), Qwen4 Max, Qwen3.7 Plus and
  Qwen3.8 Flash, with Qwen3.7 Max under More models, and no effort level, which
  Qwen takes only as a setting. Its permission levels are `--approval-mode
default`, `auto` and `yolo`. The first task rides as
  `--prompt-interactive=<task>`, one word, so a task that starts with `-` is
  not read as a flag: the runner now replaces `<prompt>` inside a word. A
  restart reopens the session's conversation by id (`--resume <id>`) once Qwen
  has written it, which the runner checks, and before then starts it again
  under the same id (`--session-id <id>`), since `--resume <id>` exits until
  something has been said and `--continue` may open another Qwen's
  conversation in the same folder; where the runner cannot tell, it is
  `--continue`. A session takes no second Qwen window: its conversation
  would read as the one the session's Qwen moved to. The chat shows what the person typed, not
  the `@file` contents or hook context Qwen stores with it. Before a message is
  typed, the runner, the API and the console empty Qwen's prompt, which an Up
  arrow, a stopped turn or a rewind can leave holding text, with Ctrl+E,
  Meta+D and Ctrl+U, which its Rewind dialog does not read.

  `runner agents install qwen` installs it from npm (Node.js 22); the runner
  does not update it, and the guide says how to. The chat reads
  Qwen's conversation file under `~/.qwen/projects/` (or `$QWEN_HOME`), and in a
  worktree session follows the conversation Qwen moves to on a `/clear`. Qwen
  Code is off in Settings → Agents until switched on, and wears Qwen's mark.

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
- 07d9016: The runner wears the console's identity: a macOS app icon for
  `OppenheimerRunner.app` (the fedora on the ink tile), and on a terminal the
  fedora beside the name at the top of `runner help`, `runner status` and the
  installer, one blue for commands and URLs, and states as a coloured dot and
  a word. `runner help` is grouped by who runs each command and when. Piped,
  logged or under `NO_COLOR` the output is unchanged; `CLICOLOR_FORCE=1`
  forces the look on.
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
- e511fb2: A session's changes can be read off its host, for the Review that comes next.

  - `@oppenheimer/shared`: the link gains `session.changes.read` and `session.changes`, gated on the `session.changes.read` capability, with their bounds; `sessionChangesResponseSchema` is the API's answer.
  - `@oppenheimer/runner`: answers `session.changes.read` with git over each checkout: every file changed since the branch left its base (or only what is not committed yet), untracked files included, with counts and patches kept under the link's frame.
  - `@oppenheimer/api`: `GET /v1/sessions/:id/changes?scope=base|uncommitted`, owner only (`sessions:read`); a host with no link or a runner without the capability is a state, no answer in 15s `SESSIONS_031`.
  - `@oppenheimer/api-client`: `findSessionChanges`.

- aa92290: A session's chat queues what is written while the agent works and shows the room left. A message sent mid-turn waits on the composer (`SessionChat.post`), to be sent now, edited or dropped, and goes on its own when the turn ends, one at a time. Beside the model, the context meter opens to the context in tokens (with Compact) and the plan's 5-hour and weekly limits with their resets.

  The limits are Claude Code's own: the runner launches a session's Claude Code with `--settings` naming `runner statusline` as its status line, which keeps what the CLI hands it (`context_window`, `rate_limits`) by conversation and still draws the person's own status line, or `ctx · 5h · 7d` when they have none; the chat follower sends the latest as an `oppenheimer.status` entry (`ChatState.status`). The runner also keeps each answer's token counts (`message.usage`), so the context is counted off the transcript until the status line says. `ComposerContextMeter` forwards a button's props, so it can be a popover's trigger, and the composer's field is no longer remounted when something appears on top of it.

- 2c0fbb5: Typing `/` in a host session's chat opens a menu of what `/<name>` runs: the project's skills and commands, then Claude Code's own commands (`/clear`, `/compact`, `/context`, `/cost`, `/init`, `/review`). The runner reads the project's from `.claude/skills` and `.claude/commands` in the folder the agent runs in and sends their names and descriptions with the chat's history (`attachment.chat`'s new `commands`); a host on an older runner gets the built-ins alone. The kit's `useCommandMenu` and `leadThenFollow` now drive both this menu and the bots one.
- ea93480: A Claude Code session read as a chat, a proof of concept behind
  `session_chat_view` (`product/design/sessions/terminal-and-chat.md`).

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
  (`product/design/sessions/session-places.md`).

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
- 341cafa: A session's terminal windows are a request and a reply, so the side pane's
  Terminal tab can list, open and close plain shells in a session's worktree
  (tmux windows 1 and up; window 0 is the agent) and attach to the one it opened.

  - `@oppenheimer/shared`: the link gains `session.windows.list` and the reply
    `session.windows` (`{ windows: [{ index, name }], opened? }`, the snapshot's
    window shape, now `sessionWindowSchema`), and the runner capability
    `session.windows.list`. `schemas/session-window` holds the API's shapes
    (`SessionTerminalWindow`, `SessionWindowsResponse`,
    `OpenedSessionWindowResponse`, `ClosedSessionWindowResponse`).
  - `@oppenheimer/runner`: names `session.windows.list` in its hello and answers
    `session.windows.list`, `session.window.open` and `session.window.close`
    with `session.windows`, the windows tmux lists after the command (the open's
    window as `opened`); refusals stay `command.failed`.
  - `@oppenheimer/api`: `GET /v1/sessions/:id/windows` (`sessions:read`),
    `POST /v1/sessions/:id/windows` and `DELETE /v1/sessions/:id/windows/:window`
    (`sessions:write`), owner only; `SESSIONS_056`–`SESSIONS_059`. Window
    commands are no longer remembered for the session's log: their refusal is
    the request's answer.
  - `@oppenheimer/api-client`: regenerated (`findSessionWindows`,
    `openSessionWindow`, `closeSessionWindow`).
  - `@oppenheimer/frontend-consumer`: `listWindows`, `openWindow` and
    `closeWindow` on the sessions service; `useSessionWindows`,
    `useOpenSessionWindow` and `useCloseSessionWindow`.

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

- ac71ace: A session can run a second coding agent in a window of its own worktree,
  beside the agent in window 0, not only a plain shell.

  - `@oppenheimer/shared`: `session.window.open` takes an optional `agent`, any
    catalog coding-agent id but `shell` (`windowAgentSchema`), with the optional
    `model`, `effort` and `permission` picked for it (the launch's bounds) and a
    first `prompt` (`session.create`'s bound, now the named `promptText`), and
    runners name the new capability `session.window.agent`.
    `schemas/session-window` adds `openSessionWindowBodySchema` (the launch
    schema plus `agent`) and `SessionWindowAgent`.
  - `@oppenheimer/runner`: names `session.window.agent` in its hello. An open with
    `agent` makes the window named by the agent's catalog id and launches the
    agent in it as window 0's is at create (folder trusted, executable held),
    with the model, effort and permission the open picked; each one not picked
    is the session's (its permission level always, its model and effort only for
    the session's own agent), and the first task as its trailing positional. A
    failed `tmux respawn-pane` names the window and no longer the command line,
    which carries the person's task. A launch that fails kills the window. `shell` and
    ids outside the catalog are refused.
  - `@oppenheimer/api`: `POST /v1/sessions/:id/windows` takes an optional body
    `{ agent?, model?, effort?, permission?, prompt? }`; no body is still a plain
    shell, and the launch fields and the prompt go to the host only with `agent`. A host whose runner lacks
    `session.window.agent` is refused with `SESSIONS_060`.
  - `@oppenheimer/api-client`: regenerated (`OpenSessionWindowRequest`).
  - `@oppenheimer/frontend-consumer`: **breaking for callers**:
    `useOpenSessionWindow().mutate` takes
    `{ sessionId, agent?, model?, effort?, permission?, prompt? }` instead of the session
    id; `openWindow(id, input?: OpenSessionWindowInput)` on the sessions
    service. The launch fields and the prompt are sent only with an agent that is
    not `shell`.
  - `@oppenheimer/translations`: `SESSIONS_060` in English and Spanish.

- 04b0f76: A session's agent can show a visual in the session's chat: `runner sessions show <spec.json | ->`, or the `show_visual` tool of the runner's MCP server. The runner checks the spec's shape and refuses one it cannot draw with each fault by its path (`SESS_023`); the console draws it where it was shown, with the same renderer as the bots' visuals. `runner --skill` teaches it with an example.
- d2df32e: Pick the session's device in the Simulator tab, and refresh it.

  - `@oppenheimer/shared`: `device.info` gains `devices` (each `serial`,
    `name`, `platform`, `free`; `DEVICE_CHOICES_MAX`), and the link gains
    `device.select`; the attach socket's `device` carries `devices` and takes
    `device.select` from the browser.
  - `@oppenheimer/runner`: a device attach looks at the host's devices afresh
    and lists them; `device.select` moves the session onto a free one,
    switches the screen on the same attachment and rewrites the agent's
    session note. A device another session holds is refused.
  - `@oppenheimer/api`: the relay passes `devices` through and forwards
    `device.select`, dropped from a read-only share.
  - `@oppenheimer/frontend-consumer`: `DeviceStream.select` and `refresh`;
    `DeviceChoice`.
  - `@oppenheimer/web`: the Simulator's device line is a picker when the host
    offers more than one, with Refresh beside it.
  - `@oppenheimer/translations`: `sessions.preview.device`, `deviceSearch`,
    `deviceEmpty`, `deviceTaken`, `refreshDevice` and `platform.*`.

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
  (`product/design/runner/direct-terminal-path.md`), behind the new
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

- 8da03fc: A visual can carry an `html` block, for what the typed blocks cannot draw: the agent's fragment runs in a sandboxed frame on `visuals.<preview domain>`, a static page the preview server serves with the network closed and only the console allowed to frame it. The console posts the fragment and its theme in and takes back only the page's height, its errors and links to open, which ask first. Without a preview domain, or with the `visual_html` flag off, the block shows its source, folded, and the bots' tool refuses it.
- 3da961d: A WhatsApp number's Settings lists its groups and saved contacts before anyone writes: the runner reports them on connect and when a group is joined or renamed or the contacts change (the new `whatsapp.chats` frame), and the API keeps them per number (`whatsapp_known_chat`, up to 5,000, forgetting a chat not reported for 7 days). A group set to a bot now wakes it on every message with words, not only a mention or a reply, up to 120 turns an hour per group. People lists the owner first, fixed on the default bot; the "Answered by" filter is searchable and caps its height; the tab counts sit on their label's baseline, and `FacetSelect` takes `size="sm"` so a filter row stands at one height.
- 62bef8b: Bots see WhatsApp images. The runner keeps each image's media key and path
  (never the image) for 48 hours, as it does a voice note's, and hands the
  image over when asked (`whatsapp.media.get` with `kind: "image"`, answered
  by `whatsapp.media` or `WA_005`–`WA_007`), behind the new `whatsapp.image`
  capability; one past a link frame is scaled down to a JPEG that fits. An
  image the owner sends, or a contact sends in a chat the number allows,
  queues the chat bot's turn as before, with its caption; when the turn
  starts, the API fetches the image and stores it as an image of the message,
  so the model is sent it and the chat shows it. One that cannot be fetched
  reaches the bot as `[image, could not be seen: …]`, so it can say why.
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

- 2f80e64: The runner reports, on each WhatsApp message, whom it @-mentions
  (`mentions`) and who wrote the message it replies to (`quotedSenderId`),
  both by phone number the way senders are, the linked number's own `@lid`
  id included. Optional on the wire, so an older runner or control plane
  ignores them. This is what lets an allowed group wake its bot only when
  someone speaks to the number.
- edcc92d: Bots send WhatsApp voice notes: `send_whatsapp_voice_note` speaks a short text on the deployment's text-to-speech server (`VOICE_TTS_*`, optional) and the runner sends it as a playable push-to-talk note over the new `whatsapp.send.voice` frame (capability `whatsapp.voice.send`). It asks like a text, with the exact words and the chat on the card, and spends the same send budget.
- 90cf44b: Bots hear WhatsApp voice notes. The runner keeps each voice note's media key
  and path (never the audio) for 48 hours, reports how long it runs
  (`voiceSeconds`), and hands the audio over when asked (`whatsapp.media.get`,
  answered by `whatsapp.media` or `WA_005`–`WA_007`), behind the new
  `whatsapp.voice` capability. The owner's voice note queues their bot's turn
  at once, in order; when the turn starts, the API fetches the note, decodes
  the Ogg/Opus to WAV in process and hears it through the workspace's
  dictation providers, so the turn opens with what the note says, or why it
  could not be heard. The transcript is kept on
  the message, and the bot's WhatsApp reads show it.
- ea40d3a: Every level of the work folder carries a `README.md` and an `AGENTS.md`:
  the root, each account, workspace, `repos.noindex/`, `sessions.noindex/`
  and session folder. The README names the id-named folder (a workspace by
  its slug, a session by its name) and lists what it holds; the AGENTS.md
  tells an agent where its checkout is and what not to touch. The runner
  rewrites them on every create and close and when it starts, and leaves a
  file at that path it did not write. A session's marker also keeps its
  name, agent, branch and checkouts.
- 718613c: ZCode (`zcode`, Z.ai's coding agent) is an agent a session can run, as a
  proof of concept read off ZCode 4.0.0's source and not yet watched live. The
  runner probes `zcode` on PATH and starts its TUI with `--mode build|edit|yolo`
  for Ask, Auto and Full access. A restart opens a fresh ZCode: its
  `--continue` exits when nothing was saved yet. ZCode has no `--model` and takes
  no first task on its command line, so its sessions offer no model, the task is
  optional as a blank terminal's is, and the person types the first one in the
  terminal; a bot's `start_session` and `runner sessions run`, whose task is
  required, refuse it. The runner
  does not install it: Z.ai publishes desktop installers and no terminal
  release. Its screen manifest reads `esc to interrupt` as working and the
  approval dialog as waiting on the person. Off in New session's picker until
  switched on in Settings → Agents.

  ZCode has a chat view. ZCode keeps its conversations in one SQLite database
  (`~/.zcode/cli/db/db.sqlite`) in OpenCode's shapes, so the runner reads it
  read-only with OpenCode's chat follower, over a store that stands in for
  OpenCode's API, and leaves out the messages ZCode writes for the model alone.
  ZCode calls those tables an implementation detail: a release that moves them
  breaks the chat view until the reader follows.

### Patch Changes

- 6c56370: A closed session's agent no longer keeps running. On one host ~110 agents of
  closed sessions (~8–10 GB) had idled for ten days, because Claude Code ignored
  the hangup `tmux kill-session` sends and nothing came after it.

  - `runner pty` hangs its program's process group up when it is told to end
    (SIGHUP, SIGTERM, SIGINT, SIGQUIT, its context) or its pane stops taking
    output, gives it 10 s to save its conversation and exit, then kills the
    group and returns. A second SIGTERM, SIGINT or SIGQUIT kills at once. While
    the pane is gone it keeps reading the program's output, so a program
    writing to a full terminal can still exit.
  - Stop, close and `uninstall --force` find the session's wrapper in the
    process table after `kill-session` and end it the same way, so `closed`
    means nothing of the session runs.
  - The daemon looks at boot and every 5 minutes for a wrapper whose session
    has no tmux session (closing and stopping kill it), ends it, and logs the
    session and pid. Only processes of this account whose command line is
    `pty --report <file> --`, with the file in this runner's
    `state/program-status/`, are ever looked at.

- e99352e: Bots and session agents now show a visual on their own when their answer compares figures, follows a trend or shows progress, instead of writing a table of numbers: the tools said "use it only when", and an eval of both (`scripts/evals/agentic-ui/`) found neither ever drew one unasked. The runner's `show_visual` also says what a metric's `delta` and a block's `format` take, which session agents got wrong.
- 2128771: A session chat's history says where it ends. The runner marks each batch of a history `more` until the one that reaches the transcript's end, `end`; the API relays it, and the console holds a first load until it is told, instead of guessing from the batches' size and pace. A chat full of screenshots, whose reads the runner slows making previews, is drawn once, at its end, not once per read on its way down.
- 8a8749d: A prompt reads as the person typed it. Pasted text no longer shows the
  `<pasted_content>` tags Claude Code wraps it in, and system reminders the CLI
  adds before or after the words are left out. This applies to the session chat
  and to the first message the runner reports. A message that opens with a
  reminder is no longer dropped from the chat.
- 66be564: A Claude Code session's chat follows the conversation its agent is in, not
  the one it launched in. After `/clear`, `/resume` or a resume that forks,
  Claude Code writes to a conversation of another name; the chat stayed on the
  old transcript, frozen at its last turn while the terminal kept working,
  the context figure in its footer went stale, and Restart resumed the old
  conversation. Window 0's status line now runs as
  `runner statusline --session <id>` and keeps the conversation Claude Code
  reports for that session. The chat moves to it at its next check, and the
  session keeps it from the next poll, so questions, the first message and
  Restart read it too. A second Claude Code in another window names no
  session and moves nothing. A session started before this release reports
  nothing until it is restarted.
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
- b3270c8: Hardening from the pre-launch security review.

  - `@oppenheimer/api`: the preview cookie is `__Host-oppenheimer_preview`, so a
    sibling preview cannot plant one; every copy a request carries is tried, and
    every `Domain` is taken off an app's `Set-Cookie` (a reader holding the old
    `__oppenheimer_preview` re-enters through a fresh ticket). A preview path
    with a control character opens the app's root. A token minted with an API
    token may not outlive it, or be accepted from addresses outside its IP
    allowlist (`TOKEN_002`). Production refuses the development database
    password.
  - `@oppenheimer/frontend-web`: `sanitizeRedirect` drops a path holding a
    control character or a backslash (`/\t/evil.example` read as `//evil.example`).
  - `@oppenheimer/web`: nginx's access log keeps no query string (and cuts the
    `Referer` at its `?`), and writes the token in a password-reset link's,
    a cloud file's and a routine webhook's path as `[redacted]`; `CSP_EXTRA_ORIGINS` is split into
    `CSP_CONNECT_ORIGINS` and `CSP_SCRIPT_ORIGINS`, and the old variable now
    widens `connect-src` only.
  - `@oppenheimer/runner`: `host.exec` refuses a bot folder (`home`) that is not
    one plain name (`EXEC_003`).

- 6d44b8d: A host with child sessions stays online. The runner no longer puts sessions
  it created for itself (`runner sessions run`, `runner sessions create`) on the
  link. Their 12-character ids are not UUIDs, so the control plane refused any
  hello that listed one, and the host stayed offline after every reconnect.
  Their events stay off the link too. Before, the control plane dropped those
  events without acking them, and the runner resent them every minute.

  The control plane now logs which fields of a refused hello or control frame
  failed, and why, instead of only how many.

- 075bf1e: An OpenCode session's chat shows the conversation its own OpenCode is working
  in. When two OpenCodes ran in one folder (two direct sessions in the same
  directory, or one run by hand beside a session), the chat showed whichever
  conversation had been touched last, often the other one's, while the terminal
  showed the session's own. The runner now listens to each live session's
  OpenCode on its own event stream, chat open or not, keeps the conversation it
  works in on the session (through a restart of the runner or the session), and
  still follows `/new`. A Restart reopens that conversation by its id
  (`--session`) rather than OpenCode's own "last one", which in a shared folder
  may be the other's.
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
- 1ff62f9: A stage that fails its self-check, or cannot be promoted, is deleted instead
  of left in `~/.oppenheimer/bin/.staging`, and each boot deletes what has sat
  there for over an hour. A Mac whose update kept failing had 22 copies there.
- 4b3fba9: Several runner processes on one host (the daemon and `runner sessions …`
  on the host, several at once) no longer lose each other's work. A save of
  the session map merges, under a lock across processes: it writes only the
  sessions this process changed, so another process's new sessions stay, and
  a session another process closed is not reopened by a stale copy. A store's
  clone, fetches and worktrees are serialised across processes too, not only
  inside one, and a deepen in another process is waited for like one here,
  so two creates on one repository no longer fail in git.
- bb3f005: The runner image builds again: it no longer copies `go.work`, which lists Go modules the image does not carry (`e2e/netsim`), and builds with `GOWORK=off` on the module's own `replace` directives.
- db64a63: `runner status`, `runner update` or any command that builds the host agent, typed in a session on macOS, no longer breaks `runner` for every session after it. macOS names a running binary by the path it was started by, so a runner started through `bin/path/runner` pointed that link at itself, and every later `runner` through it failed with "too many levels of symbolic links" until the service restarted. A runner started through the link now leaves it as it is.
- 4eda7e8: The runner's `--agent` help and the MCP `start_session` tool list agents from the runner's own table rather than by hand, so a command that starts an agent with a task no longer offers Muse or ZCode, which take none and were refused. The MCP tool now also names Oh My Pi, which it accepted but did not list.
- a3eed3c: A session's agent reaches the runner's tools again. Its MCP server (`notify`, `send_file`, `wake_in`, `watch_pull_request`, child sessions) was started as a bare `runner`, and `runner --skill` was found by name, through a PATH tmux never gave the pane: tmux takes a pane's PATH from the client that spawns it, not from the session's `-e`. The MCP server now starts by the runner's own path, and the runner carries `bin/path` on its own PATH, which every pane inherits.
- 87f7a89: `runner uninstall` no longer reports success when the control plane did not unpair the host: it still erases the identity, but prints the underlying failure (request, status, the control plane's reason) and how to finish — Remove under Settings → Hosts, or `DELETE /api/v1/hosts/{id}` with an API token — and exits 7 with `PAIR_009`. A refused revocation is `PAIR_008` rather than a registration-token error. `register` on a host that is already paired names both control planes and the `uninstall` / `register --force` commands that move it.
- 8f24bca: A session's chat is there as soon as its terminal attaches. The runner's
  first word on a conversation with nothing written yet went as
  `entries: null`, which the control plane refuses, so the chat was not
  offered until the agent's first line; it now goes as an empty list. The
  session's placeholder is the pane's own ground instead of a grey slab.
- 55f82ea: The Simulator tab streams smoothly and takes taps and drags as they are made.
  The runner scales each frame it sends to 720 pixels wide
  (`RUNNER_DEVICE_SCREEN_WIDTH`): a simulator's full-resolution frames were
  larger than the link carries, and seven in ten were dropped on the host
  without a word; one that still does not fit is logged now. A drag goes to the
  device with its own duration, and a flick with momentum, through the new
  optional `durationMs` and `momentum` on `device.input`; before, every drag was
  a 300 ms swipe sent once the pointer lifted. Taps made while the device's
  socket reconnects are held for a few seconds and sent once it is back, under a
  "Reconnecting" notice over the phone's last frame, instead of being lost.
- fa43ea6: Links an agent prints in the terminal (Claude Code's Markdown links, sent as OSC 8 hyperlinks) are clickable again: tmux now passes their URL through to the browser, and the console opens them in a new tab instead of asking first.
- 2d187ed: Update a host's runner from the console: **Update runner** in a host card's
  menu on Settings → Hosts (`product/design/runner/runner-install-and-update.md` §5, "Manual control").

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
  (`product/design/channels/answering-on-telegram-and-whatsapp.md`, slice 3),
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

- 27828c6: A WhatsApp voice note a bot sends carries its waveform: 64 bars drawn
  from the size of each Opus packet. A push-to-talk note without one shows
  its length but plays no sound on the phones (whatsmeow#517). Audio that is
  silent from start to end is refused before the upload (`WA_008`), where it
  used to go out as a successful note of the right length that played
  nothing.
- 2abb664: The work folder's guides scale with the workspace, not the host: a create
  or close rewrites only its own workspace's guides, under a lock at the root
  the daemon and the host's CLI share. A close renames the session folder to
  a hidden `.removing-…` name before deleting it, so a guide written by the
  other process can no longer make the delete fail and strand the folder
  without its marker; one a dead process left is finished at the next start.
- 3029900: A message the chat, a bot or another session types into ZCode no longer
  lands joined to ZCode's last prompt. ZCode recalls its last prompt into an
  empty input on an Up arrow (an approval dialog's, a wheel over the
  terminal), and what was typed next was sent after it. An agent's typed-input
  spelling can now name `clear` keys sent before a message; ZCode's is Ctrl+U,
  which empties its draft. The console's chat composer, the API's prompt typer
  (bots, wakes, `opp`) and the runner's `sessions tell` and child reports all
  send them; a message whose files were just pasted into the prompt does not
  clear them away.
- b645442: A ZCode session waiting at its prompt reads as idle instead of unknown, so a finished turn no longer resets the wait before the session counts as waiting on you. The rule and the two before it are now watched on ZCode 0.18.0.

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

- fc0e75d: The hosts backend for the Settings page (`product/design/runner/hosts-settings.md`).

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
    until the code switches over (`product/design/runner/host-metadata.md`).
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
- 3404cd3: A session's terminal can be shared with a link, to watch or to type, for anyone, any signed-in account or named people (`product/design/sessions/session-share-links.md`).

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
