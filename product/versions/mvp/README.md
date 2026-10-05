# MVP design

In-depth design of the MVP defined in [`../../07-mvp.md`](../../07-mvp.md).
One document per area, in the order they unblock each other. Each
document opens with what is already decided in the research notes,
then the questions still open. Decisions made here are final for the
MVP; when one changes, update the document and add a line to the log
at the bottom of this file.

A bare number is a document in this directory (`02 §6`, `09 §5`);
"note 9" with the word is a research note in [`product/`](../../README.md).

| # | Document | Covers |
|---|----------|--------|
| 00 | [Scope](00-scope.md) | The exact feature list, in and out, and the demo scene it must satisfy |
| 01 | [Protocol](01-protocol.md) | **The wire**: the two sockets and their two shapes, frame layout and the attachment id, hello, heartbeat, hints, the command list, and which calls are HTTPS instead |
| 02 | [Runner](02-runner.md) | The Go binary: process shape, subcommands, package map, the link, sessions, tmux, streaming, credentials, screen manifests, state, failure modes |
| 03 | [Control plane](03-control-plane.md) | Data model, API, relay, GitHub App, token minting, and the runner-facing surfaces: register, host JWTs, the link's server half, release rollout |
| 04 | [Guest image](04-guest-image.md) | Deferred with the VM slice; kept for later |
| 05 | [Screens](05-screens.md) | Sign-in, sidebar, Create session, session view, Settings; components and states |
| 06 | [Step-one spike](06-step-one-spike.md) | Exactly what to build in week one and how the latency gate is measured |
| 07 | [Security checklist](07-security-checklist.md) | The findings from note 04 that the MVP must satisfy, as a checklist |
| 08 | [Auth](08-auth.md) | Identity, the personal workspace, host ownership, session attach; one page instead of the starter's kernel design |
| 09 | [Runner install and update](09-runner-install-and-update.md) | The install command, the agent prompt, pairing, the user service, signed releases, self-update and rollback |
| 10 | [API: modules and data model](10-api-modules-and-data-model.md) | The module boundaries, the aggregates, the schema, the on-disk layout and the endpoint surface |
| 11 | [API implementation plan](11-api-implementation-plan.md) | The order the API is built in, slice by slice |
| 13 | [Automations](13-automations.md) | The console: what the export draws and what is built — the overview, the runs, an automation's page, the run view and the editor |
| 14 | [Hosts in Settings](14-hosts-settings.md) | The 2026-09-26 Settings frame read against `hosts/`: status and running count, what removing a host stops, the pairing poll, the CPU count |
| 15 | [Host metadata](15-host-metadata.md) | Where a host's facts live, split by how often they change: inventory, presence, networks, events; access patterns, retention, measured cost |
| 16 | [Automations: the architecture](16-automations-architecture.md) | How a run is fired, guarded and dispatched: the inbound-events hub, the schedule tick, triggers, revisions, guards, configuration, the data model; and the headless drive that runs take next, in its slices |
| 17 | [Plan](17-plan.md) | The rail's third item: the slices and the owner's decisions; tasks, goals and a calendar beside Google Calendar |
| 18 | [Plan: the product](18-plan-product.md) | What the Plan frames say, screen by screen: the board, the dialogs, tasks that start or link sessions, and the gaps the frames leave |
| 19 | [Plan: tasks and goals](19-plan-tasks-and-goals.md) | The `tasks` module: tables, ordering, the API, starting a session from a task, the attach rule, Queued |
| 20 | [Plan: the calendar](20-plan-calendar.md) | The month view from four reads, personal events, read-only Google Calendar through a port |

## Decision log

- 2026-09-12: directory created; documents seeded with decisions from
  the research notes and open questions.
- 2026-09-12: review fixes: Ephemeral lifecycle stated in scope; sleep
  scheduling aggregated per runtime VM with `runtime_vms` in the data
  model; security checklist F15 and F16 rewritten for libvirt/QEMU.
- 2026-09-12: **MVP reset to Orca-on-the-web without VMs.** Sessions
  run directly on hosts you own (direct mode), one worktree plus a tmux
  terminal each. Claude Code first, Codex next. No sleep tiers, no
  account objects, no guest image in the MVP; all VM design is deferred
  to the next slice, not deleted. Only `workspaces/` exists under
  `~/oppenheimer-ai` for now.
- 2026-09-12: sign-in is GitHub, Google, and email plus password on
  day one from a base auth project; Connect GitHub is a separate step.
  Tabs are tmux windows in one tmux session per session on a dedicated
  tmux socket. No inbound ports on hosts, relay only, Tailscale
  optional. Pairing by pasted command with a one-hour single-use token,
  plus a copyable agent install prompt served by the control plane.
  Onboarding is four screens ending on the real New session screen.
- 2026-09-15: the code starts from the Flama starter, so the control
  plane is NestJS plus TypeORM, not Hono plus Drizzle (03). The personal
  workspace is one `organization` row per account created at sign-up;
  the starter's leads and billing modules are not composed. 08-auth.md
  added as the one-page auth note for the MVP.
- 2026-09-18: the notes and the code disagreed about whether the console
  creates organizations, and the notes were the stale half. `/onboarding`
  is the console's one organization-creating screen and stays: it is the
  recovery path for an account whose best-effort sign-up hook did not
  provision a workspace, it creates only the caller's own, and an account
  with none cannot open any product screen until it does. "No roster, no
  invitations, no teams" is unchanged. Recorded in 08-auth.md, root
  `AGENTS.md` and `.agents/rules/rbac-roles.md`. 08-auth.md also now
  records that provisioning is gated on *membership* rather than
  ownership, which the MVP cannot tell apart and the teams slice will.
- 2026-09-18: the runner is designed in full (02): one binary with
  subcommands, no inbound port and a 0600 Unix socket for the credential
  helper and the CLI, one multiplexed link with a 4-byte stream header on
  binary frames, a snapshot on reconnect instead of a durable outbox, and
  a package map onto `apps/runner`'s hexagon. That map answers 02's open
  question 6 and 01's open questions 3, 4 and 5. Pairing and the agent
  install prompt keep their decisions word for word but move from 02 to 09,
  where the rest of the install story is.
- 2026-09-18: **signed self-update moves into the MVP** and gets its own
  note (09). It was in 00's out-list as "signed auto-update"; a host that
  can only be updated by the user pasting a command again is a support
  burden the first ten hosts already cannot carry, and the protocol needs
  the update-required hint anyway. F26 therefore moves from deferred into
  07's checklist. The shape: artifacts signed with an offline key whose
  public half is compiled into the binary, a manifest the control plane
  serves but cannot forge, a safe window, selfcheck before the swap, a
  health gate and automatic rollback.
- 2026-09-18: review pass on the design, and the notes moved to match it.
  01 now owns the wire — 02 §4 had grown a second copy of it — and names
  the **attachment** (one PTY on one window for one browser connection)
  as what the 4-byte stream id identifies; the two sockets have two
  shapes on purpose. Registration, uninstall and the release manifest are
  ordinary HTTPS, which is what lets a runner the control plane refuses
  on protocol grounds still fetch the version that fixes it. 03 takes the
  control-plane half 09 had been specifying from outside, and 05 takes
  the host row (version, channel, pin, last outcome). 09's swap is a
  four-state transition table rather than a paragraph, and says what
  `selfcheck` is allowed to do — not dial the control plane, not take the
  lock. F26 keeps its rootfs-image half (deferred with the VM slice) and
  gains F26a: first install is trust-on-first-use, so F26 begins at the
  first self-update, not at install. The link is a **port**, not a
  bounded context.
- 2026-09-19: **the version-1 frames win over the older screen notes**,
  after a screen-by-screen walk with the owner (PR #20). Onboarding is
  four numbered steps and a landing: sign in, name your workspace and
  its address, connect GitHub, add a host, then Ready into the console
  (00, 05, 08). A session may span several repositories, one worktree
  each on its own branch (00); the repository chip multi-selects with a
  branch pane per repository and the branch chip shows only for one
  repository (05). Every scope chip filters. The agent chip lists Claude
  Code, Codex, OpenCode and a blank terminal with the vendors' published
  marks (Anthropic's Claude mark, OpenCode's square; none for Codex),
  and the model menu is scoped to the harness. The Add host dialog is
  the one dialog; the welcome modal is gone. Both themes. The design
  system grew the components these need (`ChipSelect` rebuilt on the
  Combobox primitive so it filters, `RepositorySelect`, `StepHeader`,
  `SlugInput`, `SuccessMark`, `SummaryCard`, `SegmentedControl`,
  `AgentMark`); the frames in `design/version1/` remain the visual
  record and 05 is the written one.
- 2026-09-19: **credential kinds are contributions to the auth kernel**
  (08). `apps/api/src/auth` imported `api-tokens` and `users` to resolve
  a request's credential, so the layer everything is built on depended
  on two of the things built on it — and the hosts slice was about to
  add a third the same way. The kernel now recognises only what it
  issues (session, OAuth grant) and takes every other kind from a
  registry a module contributes to with
  `AuthModule.contributeCredentials`, in the spirit of
  `AuthzModule.forFeature` for resources — except that the providers go in
  the contributing module, so nothing has to be published
  application-wide to be reachable. Nothing about
  what a credential authorizes changed, and no error code moved that a
  client can see.
- 2026-09-19: the **shared vocabulary lands in `packages/shared`**, and two of
  these notes moved to match it. 01's open question 1 is **decided**: Zod is the
  source of truth for the wire and JSON Schema is emitted from it at build, with
  the Go structs generated from the committed artifact — one source, two
  languages. 01's "what rides the link" gains three messages the note had
  implied without naming: `events.append` with an `events.ack` that acknowledges
  **by idempotency key** (a WebSocket cannot tell "persisted" from "never
  arrived", so a batch is kept until every key is accounted for and resent
  otherwise), `attachment.credit` for the consumed-byte credit the flow-control
  section already required, and `credentials.grant` as the answer to
  `credentials.token` rather than an optional field on the ask. The hint
  vocabulary splits by socket: the link keeps three kinds and the attach ticket
  adds `host_offline`, which a connected runner could not coherently send about
  itself. 03's "repositories (cached from GitHub)" becomes **not a table** —
  listed live through the installation, remembered only by the checkout that
  took it. In the scope catalog there is no `Repository` CASL subject for the
  same reason, and no `attach` action: opening a terminal is `update Session`,
  so the model stays CRUD plus `manage`.
- 2026-09-19: the runner's two ordinary HTTPS calls carry the API's
  `/api/v1` prefix — `POST /api/v1/hosts/register` and `DELETE
  /api/v1/hosts/self` — and uninstall no longer puts a host id in the
  path: the host names itself by the subject of the boot JWT it presents.
  That JWT stays an `Authorization: Bearer` credential, which the control
  plane's resolver recognises as a host principal next to session cookies
  and personal access tokens, rather than a header of its own that would
  be frozen into every installed runner. **Key rotation leaves the
  runner** until the link can carry it: the register route redeems
  registration tokens and cannot rotate a key, and 09 §3 already places
  rotation on an authenticated link. Recorded in 01, 03 and
  `apps/runner`'s pairing client.
- 2026-09-19: **a project is the body of work a session belongs to**, and the
  layout gains a level. 03's data model lists `projects` and says a session
  belongs to one; 11's §1 is superseded at the top by
  `workspaces/<organization.slug>/projects/<project.slug>/{repos,sessions}`,
  because a session may check out several repositories and the old tree had
  nowhere to put the second one. 11's collision rule is unchanged and now names
  the project's directory: the repository's own name, or `<owner>--<repo>` when
  another repository already holds it, then `<owner>--<repo>-<githubRepoId>`,
  which is where a rejected random suffix used to be — every candidate is
  derived from the repository, so a directory can always be read back to what
  created it. A project is created by the first session that needs one, found
  again by GitHub's repository id (unique per workspace, and the conflict target
  of the create), and its slug is immutable because it is a directory name on
  every host holding it.
- 2026-09-19: the **`github/` module is built** and 03 gains the section that
  says so: six routes, one `github_installation` table, no repository table,
  and `RepositoryAccessPort` as the only thing the module exports. Two
  decisions tightened while writing it. A claim is what a workspace **holds**,
  not what it once touched: `githubInstallationId` is unique among live rows
  only, so a disconnected installation keeps its history and frees the number,
  and `GITHUB_003` means "another workspace holds this" rather than "somebody
  once connected it". And the minted repository token is **never cached** —
  GitHub gives it an hour and the runner holds it for that hour, so minting
  live is what makes "a repository removed from the installation stops working
  on the next mint" true rather than true-after-a-TTL. `github_app` is on the
  client capability subset, because a console cannot otherwise tell "you have
  not connected yet" from "this deployment has no App".
- 2026-09-19: **a host belongs to a person, and workspaces borrow it.**
  08 said a host row carries the workspace id; it now carries
  `ownerUserId` and no workspace id, the way Better Auth hangs `session`
  and `account` off `user`. The case that decides it is one person with a
  personal and a company workspace on one laptop: per-workspace, that
  machine is paired twice, runs two runners with two keys, and the second
  install has to invent a second `~/oppenheimer-ai`; per-person it is
  paired once and either workspace runs sessions on it. It is also the
  honest reading of the machine: a session there has full access to it
  (F10), runs under its owner's Unix account, and spends the agent login
  in that person's home directory. The tenant boundary does not
  disappear, it moves down: a session carries the workspace, and the host
  it names must be one its creator owns or holds a grant on. 08's open
  question 2 is **decided** with it — the pairing token is bound to the
  user who minted it, and the host it creates is theirs. Recorded in 08,
  03, 09 and `apps/api/src/hosts/`. A host's key is a **column on the host
  row** rather than a `host_keys` table, and the retired key joins it as a
  second column when rotation arrives on the link: rotation needs exactly
  two keys, never N, and every runner boot reads them.
- 2026-09-20: the host's boot assertion becomes a **contributed credential
  kind**: `apps/api/src/hosts` spreads
  `AuthModule.contributeCredentials([HostCredentialResolver])` into its own
  providers and is no longer `@Global`, so the auth kernel recognises a machine
  without importing `hosts`. The kind's *shape* stays kernel vocabulary —
  `ScopeContext` gains a `host` variant with no owner and no scopes, because the
  guards read it — and nothing about what a host may do changed. Recorded in 08
  and `apps/api/src/hosts/application/host-credential.resolver.ts`.
- 2026-09-19: **the stored lifecycle answers "is this work finished", not "is a
  process running".** `starting | open | failed | resolved` is the fold of a
  session's log; stopping a session leaves it `open` with a `stoppedAt`, and
  `resolved` is terminal. The derived group the sidebar shows is a **function of
  the row** — the agent's last observation, when it entered that state and the
  report hashes are folded columns, like `state` — because a listing cannot walk a
  log per row, and because a group computed from inputs the log never recorded is a
  group a caller can fake.
- 2026-09-19: **stopping is a decision, restarting and closing are requests.** The
  control plane will not dispatch a stopped session again, so the stop is the fact.
  Restarting and closing need work on the host that can refuse — closing pushes
  every branch and will not remove a dirty worktree unless the caller accepted the
  loss — so the API records the request and the host's own `session.restarted` or
  `session.closed` is what moves the row. A control plane that resolved a session
  itself would make the tombstone permanent before anybody had looked at the
  worktrees.
- 2026-09-19: **a session's name is part of the fold**, which is what makes "a
  model-derived title never overwrites a name a person typed" a rule a replay goes
  through rather than a check somebody has to remember. Naming is a **capability**,
  defaulting to `none`: with no provider configured a session keeps its minted slug,
  and the startup log is what says so.
- 2026-09-19: **archiving a project fails closed.** "Is any session still open in
  this project" is a question only the module that owns sessions can answer, so it
  answers it through a port that module registers; with nothing registered the
  archive refuses rather than assuming the answer it would prefer on a destructive
  path. An archived project is a tombstone on the create path too — no session can
  be started in one — and the archive and a create serialise on the project row, so
  they cannot both win.
- 2026-09-20: **the composer rework** (design sync in PR #30). The agent
  chip leaves the scope row; the composer's foot reads scope of action,
  then engine: attach and a permission level (ask / approve for me / full
  access, the last in a warning tone) on the left, the agent-and-model
  button (harness first, then its models, with a search), a five-stop
  effort slider in a popover, dictation and send on the right. Codex now
  carries the OpenAI mark. The design system grew `ComposerToolButton`,
  `AgentModelSelect`, `EffortSlider` / `EffortPicker` and `PermissionMenu`
  (05).
- 2026-09-21: the first-run flow is **wired and reachable**. Sign-up
  opens `/onboarding/workspace` rather than the console, step 2 claims
  the workspace the hook provisioned (renaming it; creating only for an
  account that has none), and the gate off the step is whether the
  address has been claimed rather than whether a workspace exists (08).
  Connect GitHub and Add host are both skippable, so a deployment with
  no GitHub App and no runner release can still finish — which also
  makes Ready's "not connected" and "no host yet" rows reachable rather
  than unreachable copy. The console builds its GitHub install link from
  `github_app_install_url` on `GET /health/capabilities`; the browser
  keeps no copy of the App slug.
- 2026-09-21: **the console is one screen.** The sidebar is the
  navigation — New session, the session list, the account menu — and the
  pane beside it is a route: the composer, a terminal, the provisioning
  steps, a closed session, or a 404 that keeps the sidebar; with nothing
  open it is the composer (changed 2026-09-27, below). The starter's chrome went with it: no 56px bar over the pane,
  no ⌘K palette, and no Settings or Profile page — those screens and
  their features were deleted rather than left unnavigated, and
  appearance and language moved into the account menu, which is where
  the frames put them. The shell learned two things to make this the
  console's shape without changing the control plane's: `chrome={false}`
  and a per-route `pane` (`measure` or `full`, so a terminal gets the
  whole content area). Hosts are paired in onboarding until the settings
  drawer arrives (05).
- 2026-09-21: **the New session screen's controls get API fields**, in
  the four notes that own them (01, 02, 03, 05) rather than a note of
  their own. The composer's foot row sets a model, a permission level and
  an effort, and the composer itself is the session's first task, so
  `POST /sessions` and `session.create` both grow `launch` and `prompt`
  (03, 01). One of those changes note 10: the launch is **folded into
  columns** on `work_session` rather than living only in the log — the
  promotion note 10 said would be "a replay, not a backfill" — because
  `restart` has to relaunch a session the way it was launched and would
  otherwise walk its log to find out. The flag strings each permission
  level and effort stop maps to are catalog data beside `command`, read
  off each CLI's own `--help` at implementation time rather than written
  from memory. **The first task is a launch option, not something typed
  at a running process**: the runner appends it to the agent's argv,
  which both CLIs document as a trailing positional, so there is no
  "the TUI is ready" moment to race with (02 §5). Exactly one end writes
  `prompt.first` — the control plane when the composer supplied a task,
  the runner off the transcript when it did not — so the two writers
  never need a shared key (02 §7). The namer gains an
  `openai-compatible` provider — one adapter for Groq, Together, vLLM,
  Ollama and the rest — so a session is named by a fast open-weights
  model, never on the critical path of creating it. 05's first open
  question, how a session is named, is closed by the same change.
- 2026-09-22: **Add host is armed on a registered host, not an online
  one** (05). The dialog picks the machine a session will run on, and
  the control plane already records a session against a host whose
  runner is still coming up — that is what the create response's
  `host_offline` hint and the chip's offline rows mean (01, 03). The
  onboarding step keeps waiting for `online`, because a first-run flow
  that ends on a machine which never came up has claimed something the
  console cannot use. The step's capability card (✓ git, ✓ tmux) stays
  on the artboard until the wire carries a host's tools: the status row
  says the runner is connected, or that it is still coming up, and
  nothing more.
- 2026-09-22: **shown-once covers the whole first-run flow**, not only
  the step that names the workspace (08). The landing could be re-opened
  by pressing Back out of the console, so an account that finished days
  ago was congratulated again on a walk it had no way to re-take. Ready
  and Add host now ask whether the navigation *is* the walk rather than
  whether the account is finished, which every arrival there is. Add
  host could not be gated while it was also the console's pairing
  screen; the dialog above took that job, so the step went back to
  first-run's. Connect GitHub stays ungated: New session's repository
  chip still sends a finished account to it to install the App.
- 2026-09-22: **the engine button offers each harness's models by name,
  from a pinned seed.** Claude Code's three aliases under generic labels
  ("Claude Opus") and Codex's empty list are both gone: the catalog now
  carries one row per model the CLI documents, keyed by the model's full
  name. A versioned label over an alias that moves under it is the pair
  that drifts apart silently, and this is the list a reader chooses
  from; a pinned name can only go stale in the open. The roster itself
  lives in `CODING_AGENTS` and nowhere else — 05 says "the harness's
  own", and open question 6 (the probe) is what the pinning makes more
  worth answering. Two console decisions came with it: the composer's
  menus are **denser than the sidebar's**, which the design system owns
  as a density on the parts rather than as measurements in the two
  menus; and a scope chip whose list has not arrived is **loading, not
  disabled** — pending says so, settled-and-empty offers the chip's foot
  action, and greying out is reserved for a chip the screen forbids,
  which is what made New session read as switched off on a cold open.
- 2026-09-23: **the agent's prompt sits on the pane's last rows**, the
  way a chat composer does, instead of under the banner with the pane
  blank below it. There is still no prompt row of ours (it gave the pane
  two carets). A full screen, or a reader scrolled back, stays where it
  is (05). The same change names the console's keymap in 05, and moves
  resize coalescing to the console at 50 ms, with the runner applying
  each size as it arrives (02 §5, §7).
- 2026-09-23: **multi-host behaviour is proved through the real register
  path, in the cheapest place that is honest about it.** A test that needs a
  host pairs one the way a user does — mint, `runner register`, the link —
  rather than writing a host row, and it runs in the lowest tier that can
  prove the property: containers for pairing, routing, link loss and
  adoption; a real OS only for what a container cannot fake (09's service
  units, linger, the signed swap; 06's gate). Recorded in 11, slice 6.
- 2026-09-23: the provisioning pane draws the host's own steps, from
  `session.step` on the log (01, 05).
- 2026-09-23: **a session is one repository in the MVP** (#56). 2026-09-19's
  several repositories per session is deferred to the runner slice that
  makes several worktrees (11's R3): the runner makes one, and a session
  that asked for two was accepted, refused by the host and left spinning.
  The create body takes at most one checkout, adding a second is
  `SESSIONS_010`, and the composer's chip holds one (00, 05, 10). With
  it, a runner's refusal of a session command is recorded on the
  session's log instead of dropped, so a start the host refuses fails
  visibly (03).
- 2026-09-23: **a session is named by a model if it is quick, by its prompt's
  own words if not, and create waits for the name** (03, "A session is named
  from its first prompt").
- 2026-09-24: **OpenCode and the blank terminal join the catalog, and Opus
  5.5 is the Claude default** (00, 01, 02, 05). Four agents launch, not
  one plus placeholders (00); `session.create` names any of the four and
  carries no permission level for the blank terminal (01); a permission
  level is one object of argv and environment, which is how OpenCode's
  `OPENCODE_PERMISSION` reaches window 0 only, the login allowlist is
  generated per agent from the catalog, and the host probe lists
  `codex` and `opencode` (02 §5, §9, §10); the composer table and the
  hide-and-do-not-send rule are 05's. The model seed follows Synara's
  model table and Orca's pricing table.
- 2026-09-24: **a pasted or dropped image reaches the agent**: the console
  uploads it, and the runner writes it outside the worktree and pastes its
  path into the prompt (01, 02 §11, 05).
- 2026-09-24: **connecting a host is hardened** (01, 02, 03, 05, 09).
  - An unpaired host is **terminal**: it gets no link, loses the one it
    has, and its runner stops dialling rather than retrying forever.
  - Uninstall is **refused while the runner's sessions run**, as 09 §4
    promised; ending them is an explicit `--force`.
  - The registration token is **not an argument** of anything the runner
    or the installer runs.
  - The installer **asks before installing anything**, on the terminal,
    and stops before the token is spent when a tool is missing; this
    replaces 09 §2.6's "decline and carry on".
  - A machine that **looks temporary is refused** unless the person says
    otherwise.
  - A person holds **a small number of unspent tokens**, and the owner is
    **told when a machine pairs**.
  - First install stays **trust-on-first-use**: the digest on screen is
    the check, and signature checks begin at the first self-update (F26a).
  - Key rotation stays with the link, as 2026-09-19 decided; the release
    manifest's lack of an expiry is an accepted risk (09 §7).
- 2026-09-25: **Grok joins the catalog** (00, 01, 02, 05): one more row in
  `CODING_AGENTS`, defaulting to Grok 4.6 because that is its CLI's default,
  with a screen manifest that is provisional until a soak. A session for an
  agent the host's runner never probed is refused at create rather than
  failed at launch, so a new row needs no protocol bump (01).
- 2026-09-26: **the project is on the console** (12, reversing 10's "the MVP
  never shows a project chip"). New session is the export's tabbed
  composer with a project chip first, whose foot row makes a project in a
  dialog: a name, default repositories with a base branch each, a default
  host and a default agent, which prefill the other chips. The API grows
  `POST /projects`, the two defaults and a `project_repository` table; a
  project made in the dialog has no origin, so the auto-created path for
  callers that send only checkouts is unchanged. The grouped sidebar and
  the row menu are the next slice. (12 was folded into 05 and 10 and
  deleted the same day; the entries below changed most of it.)
- 2026-09-26: **a session's paths keep the project that created it.** A
  session moves between projects (`POST /sessions/{id}/move`, one
  `session.moved` event the row folds, 03), and its worktree and branch do
  not: `work_session.projectSlug` snapshots the directory name at request,
  and every later launch reads it from the row rather than from the project
  the session is in now. (Reversed the same day: the layout lost its
  project level, so a move touches nothing on disk and there is no slug to
  keep; see the entry on projects as metadata below.)
- 2026-09-26: **Settings is a page, not a drawer.** The export draws it
  beside the console, opened from the account menu: `/settings` with
  Profile and Hosts as sections, Add host opening the console's one
  pairing page with `?from=settings`. It goes through the console's guard
  and no-workspace redirect and draws its own chrome. The drawer 05
  described for hosts is gone; the host card's rows come with the hosts
  slice (05).
- 2026-09-26: the version-1 frames gained a Settings page with a Hosts
  section, and the hosts backend is designed against it (14). A host
  read now carries a derived `status` and the count of sessions running
  on it; `GET /hosts` leaves unpaired hosts out unless asked; removing a
  host stops the sessions running on it, where unpairing used to leave
  them `open`; `GET /hosts/pairing/{id}`, listed in 10, is built and
  returns the host the token paired; the runner reports its CPU count.
- 2026-09-26: host metadata moves off the `host` row (15). What the
  machine is goes to `host_inventory` (written only when its facts
  change), whether it is there to `host_presence` (one narrow row
  rewritten per heartbeat), where it connects from to `host_network`
  (public addresses as the API saw them, kept 90 days), and what changed
  to `host_event` (append-only, 180 days). Heartbeat history is
  deliberately not stored. `host` keeps its old columns until the code
  switches over (expand, switch, contract).
- 2026-09-26: 15's two open questions are settled. Geography comes from
  DB-IP Lite (free, no account), and the owner is emailed about a new
  network only when the host's country or ASN changes.
- 2026-09-26: **Add host from Settings stays in Settings.** It opens the
  Add a host page at `/settings/hosts/new`, inside the Settings frame with
  its Back, as the frame draws it — not a dialog, and no longer the
  console's page with `?from=settings`. The console keeps `/hosts/new`;
  both mount the one screen. Copy host ID is left out of the host menu
  for now (14).
- 2026-09-26: 14's first open question is settled: the host card's
  location slot, drawn as "eu-west" / "local", shows the city and country
  code of the host's connecting address from DB-IP Lite (15).
- 2026-09-26: **a project is a saved scope a person creates, and metadata
  only** (00, 01, 02, 03, 05, 10, 11). It holds repositories (each on a base,
  offered by default or not) and a default host and agent; none is
  auto-created, and a session that names no project is listed in the
  workspace's **Unassigned** project, which cannot be renamed or archived.
  Nothing on a host is named after a project — the layout is
  `workspaces/<org>/{repos,sessions}` and the branch `oppenheimer/<session>`
  — so moving a session to any project is a label change, with no rule about
  its repositories (`SESSIONS_018` retired). `work_session.projectSlug` goes
  with the project level. The console is the evening export's: the grouped
  sidebar with Unassigned first, the project page, Move to any project. A
  session checks out any repositories, usually one.
- 2026-09-26: **the automations routes exist ahead of their API**, so the
  rail is whole; automations themselves stay after the MVP (00, 13).
- 2026-09-27: **the automations sidebar leaves out Unassigned**: an
  automation is set up for a project, and Unassigned only holds the
  sessions that name none (13).
- 2026-09-27: Settings → Profile is specified in 05; credential writes
  (password, email, devices, deleting the account) are session-only (08).
- 2026-09-27: **a session checks out exactly one repository in the MVP.** A
  session with none was accepted, then refused by the host at launch
  (`SESS_002`) and shown as failed. The create body now takes one checkout,
  no fewer, and the console's composer stays disabled until a repository is
  picked. A session with no git returns when a runner can make one (00, 10).
- 2026-09-27: **nothing open is New session**: the console lands on
  `/sessions/new`, and `/sessions` redirects there, instead of a "no
  sessions open" pane (05).
- 2026-09-27: **New project, Project settings, the console's Add a host
  and the automation editor are dialogs over the console again**, as the
  2026-09-27 export draws them; the `_editor` pages of 2026-09-26 are
  gone. Settings keeps its Add a host page. Add a host copies first —
  Copy install command, Copy agent prompt — and shows the instruction
  behind an Inspect fold, in the console and in onboarding; the
  automation editor holds its Task step alone until the API names a
  trigger (05, 13).
- 2026-09-27: organization routes are authorized in the organization they name (08).
- 2026-09-27: **automations move into the MVP** (00, 16). A run is a
  headless session for any agent in the catalog, translated in the API;
  `sessions/` owns execution (`session_turn`) and `automations/` only the
  firing (`automation_run`); a run acts as its owner; external events go
  through a provider-neutral `inbound-events/` hub; schedules are rows
  fired by a one-minute tick; guards and limits are configurable at three
  levels. 13's open data-model question is closed.
- 2026-09-28: **the per-host cap counts live runs, not headless turns**,
  since runs are interactive sessions until the headless drive (slice 2);
  a run whose first turn ended holds no place, one past the run limit is
  stopped, and the disk floor defers. **A run opens at
  `/automations/$automationId/sessions/$sessionId`**, the session pane
  with the automations list kept (05, 13, 16).
- 2026-09-28: 02 §5's store was a `git clone --bare` refreshed by
  fetching every branch. It is blobless with no working tree, a create
  fetches only the ref its worktree is made from, and each repository
  keeps one spare worktree checked out ahead of the next create (02).
- 2026-09-28: **Settings is two sliders, not a cog** (05). The
  version-1 export's `settings` glyph is lucide's `settings-2`, so the
  account menu's link and a project header's action both draw it, and
  05's "cog" is gone. 05 now keeps the glyph map: folder for a project,
  an arrow out for a foot action that opens another site, `Callout` and
  the Auto shield kept against the export, with the reasons.
- 2026-09-28: **The GitHub App install redirect carries a console-minted
  state** (03, 05). An addition, not a reversal: `POST /installations`
  now requires the single-use `state` that `POST
  /installations/install-state` minted for the caller in the workspace,
  so a forwarded callback can no longer connect someone else's
  installation (`GITHUB_011`). Both install entry points mint on click;
  `github_app_install_url` stays as the capability that says an App
  exists. The first-run walk rides as the state's prefix,
  `first-run.<nonce>`.
- 2026-09-29: **Effort is each CLI's own levels, per model** (01, 02,
  03, 05). The slider was five product stops that each agent mapped
  onto its flag, which put "Medium" on a Claude Code launch of `--effort
  high` and sent Codex a `minimal` no model takes. The catalog now spells
  effort once per agent and lists each model's levels and default; the
  slider draws those, starts on the default and sends nothing until
  moved, and OpenCode takes a level as the model's variant.
- 2026-09-30: **The session grid's line height is 1.3** (05). A departure
  from the export's 1.55 and from the earlier xterm value of 1: xterm
  stretches block and box glyphs to its cell, so 1.55 elongated Claude
  Code's mark and 1 packed a turn. The HTML terminal keeps 1.55.
- 2026-09-30: **The reader's messages in the session grid are drawn as the
  export's bubble** (05). Found by Claude Code's own user-message background
  and pointer, repainted in the terminal's ramp, with the tint laid over the
  grid; the input row stays the agent's own.
- 2026-09-30: **The dark session terminal is the artboard's `#1a1a1c`, frame
  included** (05). It had been set to the canvas (`#121213`) because the
  lighter terminal read as a slab on a darker page; the artboard paints the
  session's frame in the terminal colour too, so the console now does the same
  and matches it.
- 2026-09-30: **The terminal answers the line, word and select-all chords
  a desktop terminal does, and Ctrl+Shift+C copies off the Mac** (05).
- 2026-10-01: **`session.started` means the session has a terminal, not that
  its agent is up** (01, 02). The host builds the tmux session before it
  clones, so the pane exists about thirty milliseconds in and the clone, the
  worktree and the agent follow it. The console attaches on this, which puts
  the reader in the terminal while the repository is still arriving; the
  `agent` step is what says the agent was launched. The terminal is a stage
  like the others but has no step on the wire — the stepper stays
  `host/clone/worktree/agent`.
- 2026-10-01: **An attach is served while its create is still running, and is
  the only command that does not use the session's lane** (01, 02). It needs
  the tmux name and nothing else. Queued behind the create it sat out the
  clone and the agent launch — the cost that building the terminal first
  exists to remove — so it waits on the session's own terminal instead.
  Everything else still waits for the create to land: a stop sent during a
  create is answered after it, which is what keeps stop, list and unpair
  seeing one consistent set of sessions.
- 2026-10-01: **A session's worktree lives in a hidden directory**
  (`<repo>/.worktrees/<slug>`, 02). Spotlight does not descend into a dotted
  directory, and a worktree is a whole checkout written at once: left
  visible it is indexed while the agent starts, and the agent's file reads
  queue behind the scan. Two worktrees of the same commit in one parent, run
  interleaved: `wt` 30.2s, `.wt` 5.7s, `wt2` 31.5s to the agent's first
  token. `.metadata_never_index` at the workspaces root does not work —
  `mdls` still returns indexed metadata underneath it.
- 2026-10-01: **One session's row polls faster than the session list while it
  is starting** (05). The list keeps one pace; the row a reader is watching
  opens at 300ms and settles to 2s after 3s. The opening phase belongs to the
  row and not the list because its clock is kept per query and the list is one
  query for every session — a second session started during the first one's
  clone would otherwise inherit the first one's settled tick.
- 2026-10-02: **A host gets the repository ready while New session is still
  being written** (01, 02, 05). Picking a host and a repository sends
  `repository.prepare`: the store cloned or fetched and a spare worktree
  made, with a token minted for that repository and sealed into the command
  because no session exists to ask for one. Measured from the browser on a
  host that had never seen the repository, with ten seconds between the pick
  and Send: microsoft/vscode 32–34 s → 0.89–0.93 s, facebook/react 7.8 s →
  1.0–1.1 s to the agent's first screen (note 14).
- 2026-10-02: **The first clone is shallow, and the history follows in the
  background** (02 §5). A worktree needs the base's one commit, not the whole
  history: on microsoft/vscode the store is ready for a spare in 9.3 s
  instead of 25.8 s. The deepen ends at the same blobless store as before, so
  a session's `git log` and `blame` work as they did once it lands.
- 2026-10-04: **A session takes files, not only images** (03, 01, 02 §7, 05,
  07). Images, PDF and UTF-8 text, one allowlist judged by the bytes at the
  API and again on the host; text is text only when it is valid UTF-8 with
  no control bytes and opens neither with `#!` nor as HTML, SVG or XML.
  Executables, archives and scripts are refused whatever they are called,
  and the runner names every file `<id><extension from the table>`. The
  wire keeps its `image` names; a runner that takes more says so with
  `session.files`, and one that does not is sent images only.
- 2026-10-05: **Plan is in the MVP** (17–20). The export drew a third
  rail item: a board of tasks with goals over it, tasks that start or
  link sessions, and a month calendar. The owner decided it ships in the
  first version, absorbing what `next-steps/` called 0.3 Kanban; Google
  Calendar is read-only first, personal events stay, only attaching a
  session moves a card, and Queued is a console label.
