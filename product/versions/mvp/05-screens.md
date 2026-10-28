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
  Connect GitHub, on the account or an organization, all or selected
  repos, skippable; a member who can only request an organization's
  install is told an owner has to approve it (`setup_action=request`),
  then connects it by choosing the organization again; until it is done the
  repo chip lists nothing and its foot row is the way out (below). (4) Add a host, agent first (2026-10-13 export):
  the agent prompt in a card with Copy prompt, the prompt text behind its
  fold, the one-hour token's line under it with "Install manually
  instead" across from it (the install command on one line with its
  Copy), and a Connection list — Runner installed with its version, then
  Host connected with the machine's name and OS — with Continue, Skip for
  now and its note on one row. Then Ready: a success ring, "You're all set", a
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
  second sidebar (13). Since 2026-10-25 the console opens (`/`, and every
  "go to the console" after sign-in, onboarding or Settings) on the rail's
  first item: Employees by default, or whichever item the reader dragged
  to the top. A session is shown in the session pane under either
  list: opened from a run, it keeps the automations list beside it, at
  `/automations/$automationId/sessions/$sessionId` (13) — the head reads Projects with the
  count, a New project button and the filter menu, a live search box
  narrows the rows, and each project is a folding header with its count
  and two hover actions — New session here (`/sessions/new?project=`,
  which starts the composer on that project with its defaults) and
  Project settings (the project dialog editing; Delete project on its
  footer is the archive behind a confirm, and is disabled while the
  project has unresolved sessions). A
  project with no session is not listed (until 2026-10-28 it showed an
  empty row with a link to start one); with projects but no session at
  all, the list says so in one line. A row's
  ellipsis menu: Rename inline, Move to project… as a pane in the same
  menu listing every other project — moving is a label change, nothing
  on the host moves (10), so it asks for no confirmation — and Delete, a
  confirm over the close that says whether to discard work that is not
  pushed. The row leaves the sidebar on the click, while the host
  carries the close out, and comes back if the close cannot happen (the
  API refuses it, the host is offline, or the host has not resolved it
  within a minute, e.g. it refused unpushed work); before 2026-10-11 the
  row stayed until the host confirmed. The sidebar never lists a
  resolved session (the API keeps it as a tombstone). A session the host
  no longer holds — closed there with `runner sessions close`, its
  worktree deleted by hand, or its record lost — closes on Delete or on
  Restart instead of being refused for ever; after a Restart its pane
  shows it deleted. The order is the reader's: a project drags by its header among the
  others and a session drags within its project or into another one,
  folded or empty, which moves it as Move to project… does. The order is
  kept on the device, like the rail's; a project or session made since
  the last drag lands on top, and the sort's default, Custom order, is
  that order (a session dropped under another sort keeps what the reader
  was looking at and switches to it). Sessions hold still while a filter
  or the search hides some of them, since a drop would lose the hidden
  ones' places. The filter menu's Show projects checks each project
  on or off (added 2026-10-27): a hidden project's group and sessions
  leave the sidebar on this device, its place in the order is kept, a
  pinned session of it stays pinned, and the project filter still
  reaches it. Hiding is not a filter, so Clear filters leaves it. The workspace's **Unassigned** project is the first group
  until the reader moves it: a session that names no project is listed
  there. Its settings edit its
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
- New session (`NewSessionComposer.dc.html`, the 2026-10-26 export; it
  replaced the tabbed composer of 2026-09-26 and its line under the
  title on 2026-10-26): on the grey canvas, at the pane's foot where the
  session's own input will be, "What should we work on?", the project
  chip, and one box with Add files (+) at the start of a line that
  grows, dictation and send at its end (a file pasted into the field or
  dropped on the pane attaches to the first task as a removable chip over
  the line — an image, a PDF or a text file; a file it cannot take is
  refused under the box with the reason, never dropped). Under the box
  one row of choices: the host and where on it as one chip ("mac-studio ·
  New worktree", the hosts under a heading, each opening its Start in pane: New
  worktree or Folder on host; changed 2026-10-26, they were two chips),
  repository and branch (or folder), and the permission level on the left (ask for approval,
  approve for me, full access, the last in a warning tone because it
  changes a machine unattended); the agent and model and the effort on
  the right. The frame's cloud environments are not built. The project
  chip sits over the box, apart from the row, because picking a project
  offers the rest; it starts on the workspace's **Unassigned** project,
  which is where a session that names none is listed, so the chip and
  the session never disagree. Its foot action is **New project…**, a
  dialog over the console: the name; Repositories as a field that
  adds one at a time from the App's list (`RepositoryAddField`), whose
  pane ends in the same **Manage repository access** row as the
  repository chip — an organization's repositories appear once the App is
  installed on it — the added ones listed under it with an X; then a **Defaults** fold,
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
  Unassigned — offers its defaults: one named in the address applies them
  as a pick does, and a remembered one or Unassigned fills only the chips
  the last visit left empty, so a visit opens on the last choices
  (changed 2026-10-22; the project's host, agent and repository used to
  win over them). The
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
  | Codex | **GPT-6.1 Sol**, GPT-6.1 Terra, GPT-6 Astra, GPT-6 Sol, GPT-6 Luna, then GPT-5.6 Sol, Terra, Luna | yes | the model's levels |
  | OpenCode | Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 5.5 under `anthropic/` (**`anthropic/claude-opus-5-5`**), Codex's eight under `openai/`, Grok 4.7 and 4.6 under `xai/`, Gemini 4 Argon and 3.8 Flash under `google/` | yes | the model's levels, OpenCode's variants per provider |
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
  composer keeps what was chosen for the last agent, but only the controls the picked
  agent has go into the request, so a blank terminal is created with no
  permission level at all rather than one carried over, and the API
  records none. The option set is read off the catalog entry once
  (`launchControlsFor`), not one predicate per control. Chips remember last choice. Every chip filters (a search row, an empty
  line). The repository chip holds one repository in the MVP (00);
  picking another replaces it. **Changed 2026-10-26:** it holds up to five
  (00), and a sixth pick replaces the oldest. Every chip lists its current
  pick first, as it stood when the popup opened, and branches read in the
  rows' own type rather than mono. The selected row carries its branch,
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
  foot action opens the **Add a host dialog**, the same column as
  onboarding's step at the dialog's sizes: one sentence — paste this
  prompt into the coding agent on the machine — then the agent prompt's
  card with **Copy prompt**, reading Copied for a moment, because the way
  in is copying the instruction rather than reading it (the prompt itself
  is behind the card's fold); the token line under it — whose New
  token replaces the token on screen, retiring it in the same write, so a
  command pasted into the wrong window stops working at once — with
  **Install manually instead** across from it, which opens the install
  command on one line with its Copy (and the installer's SHA-256 under it
  when the deployment published one); and a **Connection** list that turns
  green in place: "Waiting for the agent to run the install" becomes
  Runner installed when the runner registers, then Host connected when it
  dials in. Use this host is enabled on the first, which closes the
  dialog with the machine picked in the chip. Settings → Hosts pairs on
  its own page instead (`/settings/hosts/new`, below), with the panel
  shown outright. **Registered, not online**, and that is the difference
  from onboarding: the step's Continue waits for the runner to dial in,
  because a first-run flow that ends on a machine which never came up
  has claimed something the console cannot use; the dialog is picking
  the host of a session, and a session may be started on a machine
  whose runner is still coming up — the control plane records it and
  owes it to that host the moment it connects, which is what the
  chip's offline rows mean too (01, 03). The Connection rows say what the
  API says — the runner registered, the runner is connected. The
  export's third row, Tools on PATH (git · tmux · claude), arrives with the
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
  last choice, the permission level included**: New session opens on
  `auto` ("Approve for me", Claude Code's accept-edits mode) the first
  time and on the last level picked after that (changed 2026-10-14; it
  opened on `full` and never remembered the level). The console always sends the level; a request that
  names none (an API token, an automation) is launched on `ask`, the
  API's reading of "unspecified" (`launchPermissionFor`), so omission
  never escalates. The memory is the browser's — where, the project, the
  host, the repository and branch, the agent, the model, the permission
  level and each agent's effort, in `localStorage`, on the device that
  chose them. It is a convenience, not a record. Every chip opens on its
  last choice, over the landing project's defaults; a project's defaults
  fill a chip only when the memory left it empty, or when the project is
  picked on the screen or named in the address (changed 2026-10-22: the
  scope was never remembered, and the landing project's host and agent
  outranked the memory).
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
- A first session on a repository its host has never held downloads it,
  and the pane says so above the steps: the host is downloading the
  repository first, this one takes a bit longer, and later sessions
  start in about a second. The clone step reads "Downloading the
  repository…" instead of the fetch's wording. Both come from the
  clone step's `download` flag (01).
- The provisioning pane stays until the `agent` step lands, not until the
  row reads `open`. The host makes the session's pane before it clones, so
  the row opens with the clone still to run (01), and a terminal shown then
  is a shell in an empty directory. The hold covers a start this console
  sent or watched; a session opened from a link or a reload after it opened
  goes straight to its terminal, without reading the log.
- Session: a bar over the terminal (2026-10-25 export): the sidebar
  toggle, the task it came from and a slash when there is one, the
  session's name, its state on a dot ("Running", "Needs input",
  "Stopped"…), then Terminal / Chat and Share on the right. A pull
  request's review session keeps the pull request's toolbar instead, and
  those two close its terminal's status line. The preview the frame
  opens beside a session has its Simulator built (2026-10-26): a
  panel-right toggle before Share opens a 440px pane on the terminal's
  right, its header the frame's pill tab, the device's state and name,
  and Close, its body the session's device in a phone's frame, live. A
  click taps, a drag swipes, typing with the screen focused types into
  it. The device is the simulator or emulator the session's host gave it,
  the one its agent drives through Argent
  (`../research/device-streaming.md`); a host that offers none says so in
  the pane. The Browser tab followed on 2026-10-27 (`30-session-previews.md`):
  Browser and Simulator are the header's pill tabs, the last one chosen
  kept on the device; Browser opens on the session's likeliest dev server
  among the ports its processes listen on, with an address bar (a port
  picker as `localhost:<port>`, Reload, Open in a new tab) over the page
  framed on its preview origin, and says when there is no dev server yet,
  the host is away or its runner cannot share ports. The resize handle and
  Expand are not built.
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
  off the Mac) never reach the page. A plain drag is tmux's selection,
  and releasing it copies to the reader's clipboard (tmux's OSC 52,
  which the console writes and never answers a read of). Shift-drag
  (Option-drag on macOS) is the console's own selection, copied with the
  chords above.
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
- **A file pasted or dropped onto the terminal becomes a path in the
  prompt** (an image, a PDF or a text file), as a drag-and-drop does in a local terminal (01
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

- **New session gets the host ready while the prompt is written.** As soon
  as the draft has a host and a repository — picked, or filled in by a
  project's defaults — the console sends `POST /v1/sessions/prepare` once
  for that host, repository and branch, and the host clones or fetches it
  and makes a spare worktree (02 §5). Nothing on screen changes and a
  failure says nothing: the create does the same work itself. What it buys
  is measured in note 14: a first session on a large repository goes from
  half a minute to about a second when Send comes ten seconds after the
  pick (2026-10-02).

- **The console hears about changes it did not make from the workspace
  event stream (03), and stands down the polls it covers.** Each change
  refetches the reads it names, at the keys they already have, so a
  session's start step, a run finishing or a host being paired shows the
  moment it commits. While the stream is live, the polls whose facts it
  carries stand down — the session list, a session's own row and its start
  steps, and a pairing token waiting to be spent — and they poll again the
  moment it drops. Presence and a run's status are not on it and keep
  polling. Every time the stream comes up, the first connect included, the
  reads it covers are refetched once, so nothing that landed before
  `ready` or during a gap is missed. One table in the console
  (`workspace-events.ts`) owns both lists. Behind the
  `workspace_event_stream` flag (2026-10-06).

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
8. **When the session pane attaches.** The pane mounts the terminal once a
   poll sees `open`. On a warm repository that wait was 1.4–2.1 s of a
   2.3 s start (note 14 of the top-level series). A shorter interval is
   not the answer: at 250 ms the three polls tripped the API's rate limit.
   Should the pane attach as soon as the create returns, which changes
   01's attach ticket and 03's relay? Or should the console be told of
   `open` another way?
   *2026-10-06:* the other way exists: `session.changed` on the workspace
   event stream (03) reaches the pane when the host appends
   `session.started`, behind its flag.
