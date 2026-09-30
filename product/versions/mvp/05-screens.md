# 05 — Screens

## Decided

- Sign-in: GitHub, Google, or email and password. Connect GitHub (the
  App install) is its own step after sign-in.
- Onboarding, four numbered steps and a landing, shown once. Each step
  opens with a Back link, a hairline and the mono counter ("2 of 4"),
  then the display title and a lead; the right half is the photo
  carousel. (1) Sign in. (2) Name your workspace: the name, and the
  permanent address under `oppenheimer.dev/`, checked for availability
  as you type with a spinner, a green check or a red cross and a hint
  in the same tone; Continue waits for an available address. (3)
  Connect GitHub, all or selected repos, skippable; until it is done the
  repo chip lists nothing and its foot row is the way out (below). (4) Add a host: Copy install command and
  Copy agent prompt, the one-hour token's line under them, the
  instruction itself behind an Inspect fold, and the status line
  flipping to the registered host when the runner registers. Then Ready: a success ring, "You're all set", a
  summary card of workspace address, code and host, and one button into
  the console, where New session has its chips prefilled (the host just
  added, the first repo of the installation, its default branch, Claude
  Code). Missing pieces are handled inline afterwards: no `claude`
  login becomes the login URL button in the terminal; no `tmux` is
  caught at the add-host step. (Replaces the earlier "four screens
  ending on New session"; decided 2026-09-19 with the version-1 frames.)
- Sidebar: sessions as a branch glyph coloured by state, name, age on
  hover; a session still provisioning joins the list at once with a
  pulsing grey glyph; New session on top, the primary button while a
  session is open and secondary on New session itself, where send is; a filter menu (project,
  repository, agent, host, sort) with the active filters as chips under
  the header; the account menu at the bottom with appearance, language
  and Settings. Since the 2026-09-26 export the
  list is **grouped by project**: a rail left of the sidebar switches the
  console's lists — Sessions and Automations, both links, the one under
  the address current, each named with its list's count beside the rail
  the moment it is hovered or focused, and the automations list is the
  second sidebar (13). A session is shown in the session pane under either
  list: opened from a run, it keeps the automations list beside it, at
  `/automations/$automationId/sessions/$sessionId` (13) — the head reads Projects with the
  count, a New project button and the filter menu, a live search box
  narrows the rows, and each project is a folding header with its count
  and two hover actions — New session here (`/sessions/new?project=`,
  which starts the composer on that project with its defaults) and
  Project settings (the project dialog editing; Delete project on its
  footer is the archive behind a confirm, and is disabled while the
  project has unresolved sessions). An
  empty project shows an empty row with a link to start one. A row's
  ellipsis menu: Rename inline, Move to project… as a pane in the same
  menu listing every other project — moving is a label change, nothing
  on the host moves (10), so it asks for no confirmation — and Delete, a
  confirm over the close that says whether to discard work that is not
  pushed. The row stays until the host confirms the close, and the
  sidebar never lists a resolved session (the API keeps it as a
  tombstone). The workspace's **Unassigned** project is the first group: a
  session that names no project is listed there. Its settings edit its
  repositories and defaults like any project's, but its name is fixed
  and it has no Delete (`PROJECTS_008`).
- The sidebar **is** the console's navigation: no nav rows, no chrome
  bar over the pane, no command palette. The console is one screen: a
  sidebar beside the pane a session opens in.
  (Decided 2026-09-21 with the version-1 frames; the starter's Settings
  and Profile screens were deleted rather than left unnavigated.)
- **Glyphs** are lucide's, one per meaning. Settings, wherever it
  appears (the account menu's link, a project header's action), is two
  sliders (`settings-2`), never the cog, since the version-1 export
  draws it that way; filtering is the vertical sliders. A project
  is a folder, on the composer's project chip as in the export. A foot
  action that opens another site, Manage repository access, ends in an
  arrow out; one that stays in the console ends in a chevron.
  Two places keep their glyph against the export: `Callout` stays
  info, check, triangle and crossed circle, because the alert circle
  marks a finished run (the design system's notes) and a bare cross
  reads as close; and the Auto permission level stays the shield with a
  check, since the export draws two different shields for it. The
  account menu's panes open on lucide's chevrons, where the export
  sets the characters › and ‹. (Decided 2026-09-28.)
- **Settings** is the one destination beside the console, since the
  2026-09-26 export drew it (`design/version1/Settings.dc.html`): the
  account menu's Settings link opens `/settings`, its own chrome — a
  plain sidebar with Back to console, then Account → Profile
  (`/settings/profile`) and Workspace → Hosts (`/settings/hosts`, with
  the count) — and the measured column the sections fill. `/settings`
  itself lands on Profile. It goes through the same guard and the same
  no-workspace redirect as the console. Hosts lists the machines as cards
  with Add host on the right, which opens the Add a host page inside
  Settings (`/settings/hosts/new`, the settings sidebar still beside it,
  the Hosts row unlit): Back, Hosts as the parent crumb, Done rather than
  Use this host, all back to the list. The console pairs in a dialog;
  Settings keeps its page, because its frame keeps Settings around it,
  and shows the Command / Agent prompt panel outright rather than behind
  a fold. The rows a host card draws — rename, remove, the
  install command and the preflight — are their own slices; the frame,
  the routes and the way back are built (2026-09-26).

  **Profile** holds, in order: the card — picture (Upload, Remove once
  there is one), email with Change, full name, `@`username, and the save
  row (Discard, Save changes, then Saved) that appears only when
  something changed; **Sign-in**, the password changed in a dialog;
  **Devices**, each signed-in browser with when it was last active, this
  one marked, Sign out on the others and Sign out of all other devices;
  and **Account**, Delete account behind a dialog that asks for the
  email typed out. Full name is **two fields side by side**, not the
  export's one, because the account stores first and last name apart
  and splitting one string on its first space gets names wrong.
- New session: on the grey canvas, a line under the title that says what
  sending will do once a project is picked ("In XRP Mobile · cloning 1 of
  1 repository, each on its own opp/ branch."; "Set the scope, then
  describe the work." until then); chips for project, host, repository,
  branch, in the grey
  band fused to the top of the composer (the tabbed composer of the
  2026-09-26 export); a composer for the
  first task whose foot row reads scope of action, then engine: attach
  (the paperclip, or an image pasted into the field, attaches it to the
  first task as a removable chip under the text; a file it cannot take
  is refused under the field with the reason, never dropped)
  and the permission level on the left (ask for approval, approve for
  me, full access, the last in a warning tone because it changes a
  machine unattended); the agent and model, the effort and dictation on
  the right. The project chip leads the row, because picking a project
  offers the rest; it starts on the workspace's **Unassigned** project,
  which is where a session that names none is listed, so the chip and
  the session never disagree. Its foot action is **New project…**, a
  dialog over the console: the name; Repositories as a field that
  adds one at a time from the App's list (`RepositoryAddField`), the
  added ones listed under it with an X; then a **Defaults** fold,
  optional, that reads what is set while closed — the host as chips, the
  agent as chips, and Cloned by default (`RepositoryRowList`: a checkbox
  per added repository with its base-branch pill). Create project is off
  until there is a name, a repository and one cloned by default; it
  closes the dialog with the project picked in the chip, its defaults
  applied. The same dialog, editing, is Project settings behind a
  header's settings glyph in the sidebar, Delete project on its footer's left; a
  new project made from the sidebar's plus lands on New session with it
  picked (`?project=`). Picking a
  project offers its defaults — its host, its agent, its first default
  repository on its base — and the chips stay the person's to change: a
  repository outside the project is as good as one inside it (10). The
  project a visit starts on — named in the address, remembered, or
  Unassigned — offers the same defaults a pick does: its default
  repository is in the repository chip when it names one, and its host
  and agent win over the last visit's choice when it names them. The
  agent lives in the engine button, not a chip: opening it
  lists the harnesses, choosing one slides to its models with a search,
  and a blank terminal is picked outright. Effort is a slider over the
  model's own levels in a popover, not a list (changed 2026-09-29; it
  was five product stops, Minimal to Max, for every agent).

  **What each agent offers**, from the shared catalog (`CODING_AGENTS`)
  and never a list kept in the console:

  | Agent | Models (default first in bold) | Permission chip | Effort |
  |---|---|---|---|
  | Claude Code | **Opus 5.5**, Fable 5.1, Sonnet 5.5, Haiku 4.5 (`claude-opus-5-5` and siblings) | yes | the model's levels; none for Haiku |
  | Codex | GPT-6 Astra, **GPT-5.6 Sol**, Terra, Luna | yes | the model's levels |
  | OpenCode | Claude's four under `anthropic/` (**`anthropic/claude-opus-5-5`**), `openai/gpt-5.6-sol` | yes | the model's levels |
  | Grok | Grok 4.7, **Grok 4.6** (the CLI's own default) | yes | the model's levels |
  | Blank terminal | none, picked outright | no | no |

  **The effort slider draws the model's own levels** under its CLI's
  names, starts on the level that CLI runs unasked, and **sends nothing
  until it is moved**, so an untouched session runs exactly as the CLI
  would. It is hidden for a model with no effort. A pick is kept per
  agent; on a model that does not offer it the slider shows the model's
  default and sends nothing, and the pick waits for a model that has it.
  Which levels exist is the catalog's (01, 02 §5).

  A control the agent does not take is **hidden, and not sent**: the
  composer keeps what was chosen for the last agent (a permission level
  is still never remembered as `full`), but only the controls the picked
  agent has go into the request, so a blank terminal is created with no
  permission level at all rather than one carried over, and the API
  records none. The option set is read off the catalog entry once
  (`launchControlsFor`), not one predicate per control. Chips remember last choice. Every chip filters (a search row, an empty
  line). The repository chip holds one repository in the MVP (00);
  picking another replaces it. The selected row carries its branch,
  which opens a branch pane for that repository. The repository chip's
  foot row is **Manage repository access** with the GitHub mark: it
  opens, in a new tab, the App's installation page, because which
  repositories the App sees is decided on GitHub and nowhere in the
  console. The address is minted on click (`POST
  /installations/install-state`, which puts a single-use state on it, 03)
  rather than read from `github_app_install_url`, which now only says
  whether the deployment has an App; Connect GitHub on onboarding mints
  the same way. It no longer goes
  back to the onboarding step (`/onboarding/github`). A deployment with no
  App has no such page: the chip says so in its empty line and has no
  foot row. The host chip's
  foot action opens the **Add a host dialog**: one sentence — run one
  command on the machine — then **Copy
  install command** and **Copy agent prompt**, each reading Copied for a
  moment, because the way in is copying the instruction rather than
  reading it; the token line under them — whose New token replaces the
  token on screen, retiring it in the same write, so a command pasted
  into the wrong window stops working at once; the instruction itself
  behind an **Inspect command and prompt** fold, as one panel with
  Command / Agent prompt tabs (the command form carries the installer's
  SHA-256 under it when the deployment published one); and a status box
  that resolves in place from "Waiting for the host to connect…" to the
  registered host, with Use this host enabled then, which closes the
  dialog with the machine picked in the chip. Settings → Hosts pairs on
  its own page instead (`/settings/hosts/new`, below), with the panel
  shown outright. **Registered, not online**, and that is the difference
  from onboarding: the step's Continue waits for the runner to dial in,
  because a first-run flow that ends on a machine which never came up
  has claimed something the console cannot use; the dialog is picking
  the host of a session, and a session may be started on a machine
  whose runner is still coming up — the control plane records it and
  owes it to that host the moment it connects, which is what the
  chip's offline rows mean too (01, 03). The status row says what the
  API says — the runner is connected, or it is still coming up. The
  capability line the artboard draws (✓ git, ✓ tmux) arrives with the
  capabilities themselves; nothing on the wire carries a host's tools
  to the console yet. The model list is the harness's own (a blank
  terminal has no model): the catalog seeds it, one row per model the
  CLI documents, each row carrying the model's full name rather than an
  alias that moves under it. The foot row's two menus are denser than
  the sidebar's, and the design system owns that density. Runtime
  and lifetime chips arrive with the VM slice.
- **When the composer can send.** A host is picked and still one this
  workspace has, and exactly one repository is picked. Until both hold,
  the text area and the send button are disabled; the chips stay live,
  since they are how the gap is closed. The host may be offline (the
  session is owed to it, above); a session with no repository may not,
  because the runner makes a session as one worktree of one repository
  and refuses one with none (`SESS_002`), and the API refuses it first
  (10, changed 2026-09-27).
- **What the foot row sets, and what it remembers.** The permission
  level is the product's own three words (`ask` / `auto` / `full`
  stored; "Ask for approval" / "Approve for me" / "Full access" on the
  control), and each agent's catalog entry says what they mean to its
  CLI. Effort is the model's own levels, under its CLI's names; a model
  that has no notion of effort hides the control. **Chips remember the
  last choice, except `full`**: a permission level that escalated itself
  because it was used once is the failure
  [`../../04-security-review.md`](../../04-security-review.md) exists to
  prevent, so a stored `full` reads back as `ask` and every new session
  starts there. The memory is the browser's — the host, the agent, the
  model and each agent's effort, in `localStorage`, on the device that chose
  them. It is a convenience, not a record: the scope is never
  remembered, because the repositories one visit is about are not the
  next visit's. The project a visit starts on outranks the memory where it
  names a default: its host or agent replaces the remembered one, and a
  chip it names nothing for keeps the last choice.
- The pane beside the sidebar is a URL: `/sessions/new` (the composer),
  `/sessions/{id}` (the terminal, or the provisioning pane while the
  session is starting, or a closed session), and anything else (a 404
  that keeps the sidebar rather than a bare page). With no session open
  the console lands on the composer; `/sessions` redirects there.
- Provisioning: named steps with a ring, a check and a mono meta line
  (container or host, clone, checkout, start the agent), an elapsed
  clock and a status word, so a slow step is diagnosable. The eyebrow is the host, the title "Starting your
  session", the line under it the scope (repository · branch). The
  steps are the host's `session.step` events read off the log, and a
  step the host has not reported is pending. A running step says what
  it is doing; a landed one its result: the time the host measured, the
  branch, "Connected", "Ready". An offline host says so under the first
  step. A failed start turns the step in hand red with the host's error
  under it, and the title to "The session did not start". A refusal
  the console can name reads in its words: `SESS_002` is "This host
  makes sessions with one repository".
- Session: terminal full-bleed, the agent's prompt on the pane's last
  rows whatever its height (a full screen, or a reader scrolled back,
  stays put), tabs (tmux windows, window 0 the
  agent, the rest shells in the same worktree), thin status line with host,
  branch, account, state, measured echo latency; login URLs as a
  button; phone layout with a key bar.
- The terminal's keymap is the program's, except the chords the
  console answers. **Shift+Enter** is a newline in the agent's prompt
  (window 0 only; a shell window gets the chord as typed). The rest hold
  in every window: **Ctrl+C** copies when text is selected and
  interrupts otherwise; **⌥←/⌥→** (Alt) move by word and
  **Ctrl+Backspace** deletes one. Off the Mac, **Ctrl+←/→** also move by
  word, **Ctrl+Shift+C** copies, **Ctrl+Shift+V** pastes and
  **Ctrl+Shift+A** selects all. On the Mac, **⌘←/⌘→** go to the start
  and end of the line, **⌘⌫** deletes to its start, **⌘⌦** (fn+⌘⌫) to
  its end, and **⌘A** selects all. A copy with nothing selected, or one
  the browser refuses, does nothing. Chords the browser keeps for itself (Ctrl+W, Ctrl+T, Ctrl+N
  off the Mac) never reach the page. Selecting text needs Shift-drag
  (Option-drag on macOS), because tmux owns plain drags.
- The session cursor is a **steady block**. It is the default, not a
  fence: a program that asks for a blinking cursor (DECSET 12, DECSCUSR)
  gets one, and tmux sets it back to steady each time it shows the cursor
  (`cnorm`). Either way a program's hide, draw, show is painted as one
  frame (02 §6), so a working agent's status line does not flicker it.
- The session grid is 13px mono at a **line height of 1.3**, not the
  export's 1.55. xterm multiplies the cell rather than adding leading, and
  its WebGL renderer draws block and box characters to fill the cell, so
  1.55 elongates Claude Code's mark while 1 packs a turn into a wall.
  `terminal.css`'s 1.55 stays: it is the HTML terminal the showcase, empty
  states and replayed logs draw, not the session canvas, so neither is
  fixed from the other.
- **The reader's own messages read as the export's `op-term__you`**: a
  rounded, full-width tint (`--hover-surface`) with a blue chevron, on the
  agent window only. Claude Code marks a user message itself, a pointer
  (`❯`) and the text on its `userMessageBackground`, which arrives through
  tmux as colour 237 (dark theme) or 255/253 (light); a row that opens on the
  pointer on that grey is a turn. Those cells are repainted in the
  terminal's own ramp, because Claude's theme is not the console's (its dark
  grey on a light console is a black bar), and the tint is laid over them.
- **An image pasted or dropped onto the terminal becomes a path in the
  prompt**, as a drag-and-drop does in a local terminal (01
  `session.image`). The status bar says while it travels; a refusal
  stays on screen until dismissed.
- Settings → Hosts (above): each host a card with its status and running
  session count, rename, copy ID, and a remove dialog that names what
  removal stops — built, its backend is 14. The install command and the
  agent prompt are the pairing page's; the preflight result (git, tmux,
  claude) comes with the slice that needs it. Accounts arrive with the
  accounts slice.
- A host row also carries what the update story needs to be operable on
  a fleet of one: the running **version**, the **channel**, whether it
  is **pinned** (and to what), and the **last update outcome** —
  including a rollback, which is the one a person must not have to find
  in a log. A host that has silently stopped updating is the failure
  nobody notices, so pinned and failed are states the row shows rather
  than states you infer from a version that stopped moving. Actions:
  Update now, change channel, pin/unpin (09 §5).
- Web framework open: Vite SPA recommended, Next.js as a client app
  acceptable. Decide at step 3.

## Open questions

1. ~~Session naming: user-typed, derived from the first task, or from
   the branch?~~ **Decided: derived from the first task**, and the
   sidebar shows that. A session is minted with a slug, because the
   directory and the branch have to exist before anything has been
   typed; the first prompt then names it through a configured model, and
   a name a person typed is never overwritten by one a model derived
   (03). The branch was the alternative and says less: several sessions
   on one repository would read alike, and the branch is already on the
   status line.
2. State dot colors and what "blocked" looks like on the card: a dot,
   a badge, or the last line of output?
3. Phone key bar contents: Esc, Tab, Ctrl, arrows, paste. Anything
   else?
4. Where do usage meters go later, so the status line leaves room?
5. **A policy that forbids `full`.** A host is somebody's laptop. Should
   a workspace be able to refuse full access outright, and is that a host
   setting or a workspace one?
6. **Model discovery.** Orca probes the CLI and degrades to the catalog
   seed on a failed probe. Do we probe at pairing time and put the result
   on `host.capabilities`, or stay with the seed for version 1? Pinned
   model names raise the cost of staying on the seed: a name the catalog
   lists and a given host's CLI does not know fails in that session's
   terminal, where a probe would have kept the row off the list.
7. ~~Dark only, like the mockups, or both themes?~~ Both; the version-1
   frames and the design system carry both, "Match system" the default.
