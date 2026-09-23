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
| 05 | [Screens](05-screens.md) | Sign-in, sidebar, Create session, session view, settings drawer; components and states |
| 06 | [Step-one spike](06-step-one-spike.md) | Exactly what to build in week one and how the latency gate is measured |
| 07 | [Security checklist](07-security-checklist.md) | The findings from note 04 that the MVP must satisfy, as a checklist |
| 08 | [Auth](08-auth.md) | Identity, the personal workspace, host ownership, session attach; one page instead of the starter's kernel design |
| 09 | [Runner install and update](09-runner-install-and-update.md) | The install command, the agent prompt, pairing, the user service, signed releases, self-update and rollback |
| 10 | [API: modules and data model](10-api-modules-and-data-model.md) | The module boundaries, the aggregates, the schema, the on-disk layout and the endpoint surface |
| 11 | [API implementation plan](11-api-implementation-plan.md) | The order the API is built in, slice by slice |
| 12 | [Test fleet](12-test-fleet.md) | How the MVP is tested with many hosts: a fleet of runner containers in compose, the Mac Studio as the lab of real macOS and Linux hosts, staging on Hetzner (proposal) |

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
  steps, a closed session, "no sessions open", or a 404 that keeps the
  sidebar. The starter's chrome went with it: no 56px bar over the pane,
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
- 2026-09-23: 12-test-fleet.md added as a **proposal**: three tiers — a
  hermetic fleet of runner containers against the real API in compose
  (laptop and CI), the Mac Studio as the lab of real macOS and Linux
  hosts (Lima, tart, a self-hosted Actions runner), and one Hetzner
  staging control plane the lab pairs with. The main server is staging,
  not the Mac Studio, so the tested topology is the product's: hosts
  behind a NAT dialling out. Several hosts on one Mac are several Unix
  users, because the tmux socket is per user by design.
