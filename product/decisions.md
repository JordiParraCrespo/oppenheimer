# Decisions that changed

Every decision that replaced an earlier one, so nobody is misled by an
older note. When a decision changes, update the note that made it, add a
dated line here, and keep [`brief.html`](brief.html) in sync;
`scripts/check-product-sync.mjs` fails a branch whose notes moved without
both. An edit that changes no decision says so in a commit trailer,
`Product-Sync: <why>`. Lines are never rewritten: a later decision gets a
line of its own.

There are three logs, kept as they were written. A new line goes in the
one its decision belongs to:

- [Across the product](#across-the-product): what one part of the notes
  changed about another (the planning notes, the design, the stack).
- [The design](#the-design): decisions inside `design/`, started as the
  MVP decision log; "the MVP decision log" in older lines means this one.
- [The roadmap](#the-roadmap): what comes next and in what order.

## Across the product

- `archive/vision-and-plan.md` proposed the Claude Agent SDK as the core. `archive/terminal-first.md` replaced it
  with a raw terminal; the SDK is a later add-on for unattended runs.
- `archive/vision-and-plan.md` proposed a Node runner. `archive/machines-and-vm-provisioning.md` changed it to a single static
  Go binary.
- `archive/multi-account.md` first flagged the macOS Keychain as a blocker for multiple
  Claude accounts; it then verified that Claude Code 2.1.144+ scopes the
  Keychain entry per config dir, so it is not.
- `archive/mvp.md` was first written as a five-screen MVP, then cut to sessions
  only on direct machines, then, after seeing the console mockups,
  reset to sessions in VMs with repo, branch, and agent chosen at
  creation. The session view stays a terminal; the Agent SDK stays out.
- `archive/security-review.md` first proposed one persistent home volume per target. After a
  review found that conflicted with running two accounts concurrently,
  `archive/security-review.md`, `archive/multi-account.md`, and `archive/mvp.md` now use one volume per account.
- `archive/mvp.md` records the VM lifetime decision: pause while idle, resume on
  visit, destroy on close. The phase table in `archive/vision-and-plan.md` is superseded by
  the order of work in `archive/mvp.md`.
- `archive/mvp.md` chose Firecracker first. `archive/reuse-gha-runner.md` replaced it with libvirt/KVM
  because an existing, hardened controller already runs that on the
  target host. Firecracker is now a later cold-start optimization.
- `archive/targets-and-github-auth.md` and `archive/github-experience.md` described Claude Code on the web's access model, where
  the user's OAuth grant reaches any repository the account can see and
  the App only adds webhooks. `archive/github-app-install.md` chooses the stricter model: the
  App installation, with all or selected repositories, is the access
  control.
- `archive/mvp.md`'s single "pause when idle" became `archive/sleep-wake-and-pricing.md`'s three tiers,
  tuned to the real host (i7-6700, 64 GB, SATA SSD): pause in RAM after
  ten minutes, suspend to disk after two hours, hibernate after a day.
- `archive/mvp.md` said a VM per session. `archive/workspace-layout.md` keeps that for Ephemeral
  sessions and makes Keep sessions worktrees inside one workspace VM per
  repo per host, so the worktree UX matches Orca and ten sessions on a
  repo share one clone, one setup, and one Docker daemon.
- `archive/vision-and-plan.md` proposed Next.js for the web app. `archive/mvp.md` §11 leaves the
  framework open with a recommendation for a Vite + React SPA; Next.js
  used as a client app is also fine. The firm point is only that the
  console is a real-time client, not a server-rendered site.
- `archive/mvp.md`'s VM-based MVP is superseded by `design/foundations/scope.md`: the MVP
  is Orca on the web without VMs, sessions directly on your own hosts,
  Claude Code first. The VM design is the slice after, not deleted.
- Sign-in was GitHub-only; it is now GitHub, Google, and email plus
  password on day one, with Connect GitHub as a separate step
  (`design/foundations/scope.md`).
- `archive/vision-and-plan.md` and `archive/mvp.md` and `design/foundations/control-plane.md` said Hono plus
  Drizzle for the control plane. The code started from the Flama
  starter, so the control plane is NestJS plus TypeORM on Postgres, with
  Better Auth for identity. The modules and the data model are unchanged;
  only the framework is (`design/foundations/control-plane.md`).
- The codebase keeps every app the starter ships (admin, mobile, CLI,
  MCP, showcases, Helm) from day one, so later slices need no porting.
  Only `api`, `web`, `runner`, `docs` and `e2e` are the MVP; the rest is
  carried, not built on, until its slice arrives (`AGENTS.md`).
- The personal workspace is a row in the starter's `organization` table
  with the account as its single owner member, created at sign-up. No
  roster, no invitations, no teams are exposed in the MVP
  (`design/foundations/auth.md`).
- Signed self-update moved from `design/foundations/scope.md`'s out-list
  into the MVP. What changed is *when*, not what: F26 always said signed
  updates the control plane cannot forge. Design in
  `design/runner/runner-install-and-update.md`; F26 is now on the `design/foundations/security-checklist.md`
  checklist.
- `archive/machines-and-vm-provisioning.md` cited herdr from its website. `research/lessons-from-herdr.md` reads its source: the
  architecture matches ours, but herdr owns the PTYs, so its agents do not
  survive a restart. Our tmux layer is what buys that, at the cost of
  terminal fidelity — recorded as a trade, not a win.
- `design/foundations/scope.md` and `design/console/screens.md` said onboarding was four
  screens ending on New session and a session was one repository. The
  version-1 frames, walked with the owner on 2026-09-19, changed both:
  onboarding names the workspace and lands on a Ready summary, and a
  session may span several repositories, one worktree each. Recorded in
  `design/foundations/scope.md`, `design/console/screens.md`, `design/foundations/auth.md` and the MVP decision log.
- `design/foundations/scope.md` and `design/console/screens.md` said, from 2026-09-19, that a
  session may span several repositories. The runner makes one worktree per
  session, and a two-repository session was accepted, refused by the host and
  left spinning (#56); on 2026-09-23 the owner set the MVP to one repository
  per session. The model keeps checkouts as a list with a primary, so several
  repositories returns with the runner slice that makes several worktrees.
  Recorded in `design/foundations/scope.md`, `design/console/screens.md`, `design/foundations/api-modules-and-data-model.md` and the MVP decision log.
- `design/foundations/api-modules-and-data-model.md` said a session has zero or
  more checkouts, zero being a session with no git. The runner makes a
  session from exactly one repository, so a session with none was recorded,
  then failed on the host. On 2026-09-27 the owner set the create body to
  exactly one checkout, and the console's composer stays disabled until a
  repository is picked. Recorded in `design/foundations/scope.md`, `design/foundations/api-modules-and-data-model.md` and the MVP decision log.
- `design/foundations/auth.md` said first-run's gate is the claimed address
  off step 2. That still ends step 2, and it cannot end the flow: two
  steps run after the claim, so every legitimate arrival at the Ready
  landing is finished too. The landing asks instead whether the
  navigation *is* the walk, and `/onboarding/ready` reached any other way
  — Back out of the console, a typed address — returns the reader to the
  console, and Add host asks the same, now that the console pairs a
  machine in its own dialog rather than sending readers into step 4.
  Connect GitHub is not gated, because New session's repository chip
  still sends a finished account there to install the App
  (`design/console/screens.md`).
- `archive/targets-and-github-auth.md`'s open question about screen manifests is answered by `research/lessons-from-herdr.md`:
  lifecycle hooks are authoritative where an agent has them, screen reading
  is the fallback, and rules carry a priority and negative guards rather than
  being a chain of ifs (`design/runner/runner.md` §9).
- The control-plane modules and data model *have* now changed, where the
  line above said only the framework had. `design/foundations/api-modules-and-data-model.md`
  replaces `archive/machines-and-vm-provisioning.md`'s seven modules and its first-cut table list with
  five modules — `hosts`, `github`, `projects`, `sessions`, `relay` —
  and eight tables, held to the shape of the starter's own Better Auth
  schema —
  flat rows, credentials inline with their subject, a table only where
  the lifetime is independent. `installations` and `repositories` merge
  into one aggregate;
  `tokens` becomes a port rather than a module because an installation
  token is never stored; `events` is a table inside `sessions`; `jobs`
  disappears because the outbox already is one. Models and coding agents
  get no table at all, and "GitHub allowed repositories" turns out to be
  the same noun as "repositories" — the App installation is a boundary
  GitHub already enforces.
- `archive/workspace-layout.md` said one worktree per session under
  `workspaces/<repo>/main`. `design/foundations/api-modules-and-data-model.md`
  supersedes its §1: a session may check out **several** repositories,
  those checkouts live under the session rather than under the repo, and
  one bare store per repository serves the workspace. The store is a
  bare clone, always owner-prefixed, and every directory name is a
  database constraint instead of a convention. A **project** level above
  the repository was in `design/foundations/api-modules-and-data-model.md`'s first draft and was taken out on
  2026-09-26, when a project became a saved scope a person creates and
  metadata only, so a session can move between projects without anything
  on disk moving. `archive/workspace-layout.md` §2 onward still stands.
- `design/foundations/auth.md` said hosts belong to the workspace that
  paired them, then to a workspace and an owner. `design/foundations/api-modules-and-data-model.md` now
  makes a host the person's, borrowed by every workspace they are in,
  the way Better Auth hangs devices and logins off `user`; the on-disk
  layout gains a `workspaces/<org>/` level. `archive/multi-account.md`'s
  per-account config directories remain the answer to several logins on
  one machine, and remain a later slice.
- `design/foundations/api-modules-and-data-model.md` first mirrored every installation's repository set
  with webhooks and a resync. It now lists repositories live from GitHub
  and keeps a row only for repositories a session has checked out.
  `archive/github-app-install.md`'s "the installation is the access control" is unchanged; what
  changed is that we stopped keeping a copy of the list it controls.
- The same note then dropped the repository table entirely: a checkout
  carries GitHub's ids inline and the runner owns the store on disk.
  Seven new tables, not eight.
- `design/console/screens.md` described a settings drawer holding
  hosts, and the console kept the starter's Settings and Profile pages
  underneath it. The version-1 frames of 2026-09-21 drew neither, so the
  console became one screen — sidebar plus pane — and both pages were
  deleted rather than hidden, with the drawer as the later answer for
  hosts. The 2026-09-26 export then drew Settings as a page of its own
  beside the console — `/settings`, opened from the account menu, with
  Profile and Hosts as its sections and the console's pairing page behind
  Add host — and `design/console/screens.md` records that page; the drawer is gone (2026-09-26).
- `design/foundations/api-modules-and-data-model.md` said a model was a
  launch option "recorded in the log, not a column", and made the
  promotion conditional on a reader needing it per row. `restart` is that
  reader, so the note now records the promotion as decided: the three
  launch options the composer's foot row sets are folded onto
  `work_session`, which is a projection of the log and so was a replay
  rather than a backfill. "No table, no endpoint" is unchanged, and the
  flag strings each permission level maps to are catalog data beside
  `command`, not a column per agent. The surface itself is in the notes
  that own it — `design/foundations/control-plane.md` for the route and the
  fold, `design/foundations/protocol.md` for the wire.
- The coding-agent catalog seeded Claude Code with the aliases its CLI
  documents (`opus`, `sonnet`, `fable`) and gave Codex no models at all,
  on the argument that a pinned id is a list this repository has to keep
  current. Both halves changed: the seed is now one row per model each
  CLI documents, keyed by the model's full name, because the engine
  button shows a person a *generation* and an alias that moves under a
  versioned label is a pair that goes out of step on the host with
  nothing on screen saying so. `design/console/screens.md` keeps "the
  model list is the harness's own" and holds no roster; the list lives
  in `CODING_AGENTS`. The probe (`design/console/screens.md`, open question 6) is still open, and
  pinning raises what it is worth.
- `design/foundations/protocol.md` said the epoch was "a counter bumped on
  every successful connect". The in-process counter restarted at 1 with
  the API. The runner refuses an epoch that is not newer than its last,
  so after a deploy a host needed dozens of redials to get back on. The
  epoch's floor is now the control plane's clock in milliseconds. The
  same note now also says that PTY bytes are never dropped, how the
  runner's writer orders frames, and that liveness is ping/pong.
- `design/foundations/scope.md` now lists five catalog agents; Grok is the
  fifth (2026-09-25).
- `design/console/screens.md`: the repository chip's foot row was
  "Connect a repository…", back to the onboarding step. It is now
  "Manage repository access", a new-tab link to the GitHub App's
  installation page (2026-09-26).
- `design/foundations/api-modules-and-data-model.md` said the MVP never shows
  a project chip. The 2026-09-26 export puts one first on New session, with
  a New project page behind it; `design/console/screens.md` and `design/foundations/api-modules-and-data-model.md` now carry the chip, the page and
  the model (2026-09-26). The chip starts on the workspace's Unassigned
  project, where a session that names none is listed.
- `design/console/screens.md`: the project dialog and the Add host dialog
  are pages over the main column (`/projects/new`, `/projects/{id}`,
  `/hosts/new`) since the 2026-09-26 evening export, and the second rail
  item reads Automations. A project needs a repository to be saved from the
  console (2026-09-26).
- `design/console/screens.md` and `design/automations/automations.md`: those pages went
  back to dialogs over the console with the 2026-09-27 export — New
  project and Project settings, the console's Add a host, the automation
  editor as a three-step wizard — while Settings keeps its Add a host
  page. Add a host copies first and shows the instruction behind a fold,
  in the console and in onboarding (2026-09-27).
- `design/foundations/scope.md` kept routines out of the MVP whole. The
  console's automations list and its pages have their routes now, so the
  rail is whole; the automation itself — scheduler, trigger, runs — stays
  after (`design/automations/automations.md`, 2026-09-26).
- The order after the MVP was VMs with sleep tiers, the accounts model,
  then `archive/github-experience.md`'s GitHub pieces (`brief.html`, `design/foundations/scope.md`).
  On 2026-09-26 the owner set a new order: 0.2 Git/GitHub, 0.3 Kanban,
  0.4 Slack, 0.5 Mobile, 0.6 MCP/CLI/agent, 0.7 terminal and chat
  display. Multi-account (`archive/multi-account.md`) is on the list with no version yet.
  VMs are not placed. See `roadmap.md`.
- `design/console/screens.md` said version 1 has no settings page and
  that hosts would be listed later in a drawer. The 2026-09-26 frames
  draw a Settings page with a Hosts section, and
  `design/runner/hosts-settings.md` designs its backend. Two host
  behaviours changed with it: removing a host now stops the sessions
  running on it (it used to close the link and leave them `open`), and
  `GET /hosts` leaves unpaired hosts out unless `include=unpaired`
  (2026-09-26).
- `design/foundations/api-modules-and-data-model.md` kept a host's
  metadata on the `host` row: `hostname`, `os`, `arch`, `runnerVersion`,
  a `capabilities` jsonb and `lastSeenAt`, rewritten whole on every
  heartbeat. `design/runner/host-metadata.md` splits it by rate of
  change into `host_inventory`, `host_presence`, `host_network` and
  `host_event`; the old columns go in a later contract step (2026-09-26).
- `design/console/screens.md` had Settings → Hosts open the console's
  Add a host page with `?from=settings`. It now opens the same screen
  inside Settings, at `/settings/hosts/new`, with the settings sidebar
  beside it, and the host menu drops Copy host ID for now (2026-09-26).
- `design/runner/hosts-settings.md` left the host card's region or
  "local" open. It shows the city and country code of the host's
  connecting address, from DB-IP Lite, instead of a cloud region
  (2026-09-26).
- `design/foundations/scope.md` kept automations out of the MVP, and
  `design/automations/automations.md` built only their console routes. They
  are in the MVP now, designed in `design/automations/automations-architecture.md`:
  headless runs for any agent, an inbound-events hub for GitHub and later
  Slack, schedules fired by a tick, a run acting as its owner. `archive/github-experience.md` §7's
  API `POST /fire` trigger, its regex PR filters and its `claude/` branch
  prefix are not in the frames and are not built; the frames' one filter
  value per trigger and the event-dependent starting branch are
  (2026-09-27).
- The automations architecture capped **headless** runs per host; runs
  are interactive sessions until the headless drive lands, so the cap
  counts **live** runs of either drive — a run whose agent finished holds
  no place — and a run past the run limit is stopped. A run opens in the
  session pane under `/automations`, keeping the automations list beside
  it (2026-09-28).
- An automation's page opened on the large page header (44px glyph, 28px
  title) and no Back at desktop widths; the frame draws the ordinary page
  header under a Back pill, so the console does too. The same pass put the
  automations pages on the grey canvas with white cards, as the frame does,
  and drew Where it runs as rows of one card rather than stacked fields
  (2026-09-28).
- The frames draw run history only once there is a run; the console now
  draws it always, thirty empty days on a new workspace, so the pages keep
  their shape from the first visit (2026-09-28).
- `design/console/screens.md` put Project settings behind a cog. The version-1 export's settings
  glyph is two sliders, so both Settings controls in the console draw
  that, and `design/console/screens.md` keeps one glyph per meaning (2026-09-28).
- `design/foundations/control-plane.md` checked an attach ticket at redemption only. An open attachment is now
  judged again every minute (session state, membership, account standing,
  host access), and minting a ticket or restarting a session checks the
  host too, so a revoked grant ends a terminal already streaming
  (2026-09-28).
- `design/automations/automations-architecture.md` §Q6 de-duplicated deliveries by `(source, deliveryId)` alone. The
  delivery id is an unsigned header, so the raw body's SHA-256 is unique
  per source too, and GitHub `installation` events apply in the order of
  GitHub's own timestamp rather than receipt (2026-09-28).
- A host's credential ignored its owner's standing. A banned or deactivated
  owner's runner is now refused at the link handshake and closed by a heartbeat
  within a minute, and a session's git token is not minted for a creator who may
  not act (2026-09-28).
- `design/runner/host-metadata.md`'s retention periods, the pairing token's lifetime and cap (`design/foundations/scope.md`, `design/runner/runner-install-and-update.md`) and
  the API's default and auth-failure rate limits were fixed in code. They are
  now deploy-tunable through the root `.env` (`RETENTION_*`, `HOSTS_*`,
  `RATE_LIMIT_*`), with the product's numbers as the defaults (2026-09-29).
- `design/console/screens.md`'s composer drew a paperclip wired to nothing; it now attaches images
  to the first task (`design/foundations/control-plane.md`) (2026-09-28).
- `design/runner/runner.md` had the runner build a session's tmux session
  last, after the stores and the worktree, and `session.started` therefore
  meant "the agent is up". Every second of the clone was then a spinner, and
  the console's attach either waited for the whole create or was refused. On
  2026-10-01 the terminal became the first stage: `session.started` means the
  session has a pane, an attach is served while the create is still running,
  and the worktree moved into a hidden directory so Spotlight stops indexing
  it while the agent boots. Recorded in `design/foundations/protocol.md`, `design/runner/runner.md`, `design/console/screens.md` and the MVP decision log.


- `design/runner/runner.md` had a store's first clone be blobless
  (`--filter=blob:none`) and the whole of a create's network work happen
  after Send. On 2026-10-02 the first clone became shallow at the base and
  deepened in the background into the same blobless store, and New session
  started sending `repository.prepare` when a host and a repository are
  picked, so the clone and the spare worktree are made while the prompt is
  written (`design/runner/runner.md` §5, `design/foundations/protocol.md`, `design/console/screens.md`; measured in `research/session-boot-time.md`).
- `design/foundations/control-plane.md`, `design/foundations/protocol.md` and `design/console/screens.md` let a session take images only; on 2026-10-04 it takes files
  (images, PDF, text) judged by their bytes, and a runner that does not
  announce `session.files` is still sent images only (`design/foundations/protocol.md`, `design/runner/runner.md`, `design/foundations/control-plane.md`, `design/console/screens.md`, `design/foundations/security-checklist.md`).
- `roadmap.md` placed a kanban board in 0.3. On 2026-10-05 the design
  export drew it as Plan (tasks, goals, a calendar) and the owner put it
  in the MVP (`design/plan/plan.md`); 0.2 with pull requests is next.
- `design/plan/plan.md` and `design/plan/plan-tasks-and-goals.md` put Plan behind a `plan` release flag, with a task summary
  endpoint, a `'task'` session origin and an automation occurrences
  endpoint. The first version shipped with none of them: no flag, the
  board's one read serves every count, a task's session is a person's and
  its link records the task, and the console computes automation runs
  (`design/plan/plan.md`, "As built").
- `design/plan/plan.md`, `design/plan/plan-product.md` and `design/plan/plan-tasks-and-goals.md` named Plan's grouping of tasks **goals**. The 2026-10-13
  export renamed them milestones, and the owner had the rename go all the
  way down, tables and routes included (`design/plan/plan-milestones-stats-accounts.md`).
- `design/plan/plan-milestones-stats-accounts.md` first gave Plan's console a Stats view, a project overview, a
  project list in the sidebar, a Blocked row on tasks and a toggle per
  Google account. The owner had the console match the 2026-10-13 `Tasks`
  frame instead (2026-10-13): Tasks, Milestones (the timeline alone) and
  Calendar, nothing more. The API pieces stay for the agents' Projects
  section (`design/plan/plan-milestones-stats-accounts.md`, "Settled since").
- `design/plan/plan-calendar.md` had a Google event open read-only with only "Open in Google
  Calendar". Since 2026-10-20 a Google event that is a video meeting
  (Meet, or Zoom, Teams or Webex through an add-on or a link pasted
  in the location or description) also offers
  Join meeting from the calendar; the layer is still read-only
  (`design/plan/plan-calendar.md` §1, §5).
- `research/reviewing-at-agent-speed.md`'s first version proposed protecting the reviewer and the
  evening: a WIP limit on agent PRs, quiet hours, overnight holds. The
  owner rejected it the same day (2026-09-27): the product is for people
  who push hard. `research/reviewing-at-agent-speed.md` now goes after the review bottleneck instead,
  with lanes, auto-merge for easy PRs, and a review session prepared
  with the context.
- `research/reviewing-at-agent-speed.md` then settled its own questions with the owner (2026-09-27):
  Jev picks the lane, and each lane has an agent (verification, summary,
  full review); review is an automation with the agent picked in its
  Agent step; auto-merge covers every PR that passes. The same day it
  said the Oppenheimer App would approve as its own reviewer; on
  2026-09-28 the owner changed that: we approve and merge in the user's
  name, with their own authorization, and when GitHub will not allow it
  the PR waits.
- `globals.css` made the console's ground white. Since 2026-10-06 it is
  the export's grey under every page, and the shell, not the screen, draws
  each page at the route's measure ("The design", below).
- `design/console/screens.md` had the console learn of every change it
  does not cause by polling. On 2026-10-06 a workspace event stream was
  added, behind the `workspace_event_stream` flag, and the polls it covers
  stand down while it is live and poll again when it drops
  (`design/foundations/control-plane.md`, `design/console/screens.md`). Issue #239 asked which version
  it belongs to: the MVP, since the polls it speeds up are the MVP's own.
- `design/pull-requests/pull-requests.md` had the queue read every repository
  the installation reaches, so your pull requests and the reviews asked
  of you came from anywhere while Watching stayed opt-in. It now reads
  what the reader watches and nothing wider; the wider reach returns as
  one search rather than a listing per repository. That note holds the
  rule and what the reach cost (issue #247).
- `design/foundations/auth.md` had a terminal open only to a member of the
  session's workspace. Since 2026-10-08 a member can share one with a
  link, to watch or to type, for anyone, any account or named people
  (`design/sessions/session-share-links.md`). The link's ticket is judged
  as its creator's, so it opens nothing they could not.
- `design/sessions/session-share-links.md` built sharing on 2026-10-08 as
  bearer links (anyone signed out, any account, or named people; the
  secret shown once). On 2026-10-13 it was rebuilt to the `ShareSession`
  design: one share per session at one address, named people or anyone
  signed in, write for named people for a day at most. The note keeps the
  links under Superseded.
- `archive/multi-account.md` described Orca as a viewer over files the vendor CLI owns.
  Its source shows that holds for the default login only: for a managed
  account Orca captures, stores and refreshes the token itself. `archive/multi-account.md`
  says so in a correction under that paragraph, and its rule that the
  platform never reads the credential file is now a deliberate
  difference from Orca (`research/orca-web-auth-and-cross-host-logins.md`).
- `design/pull-requests/pull-requests.md` §6 said a repository the App is not
  installed on does not appear in the queue. On 2026-10-08 the owner
  pointed at organisations where it never will be: such a repository's
  PRs now fill the same queue row by a search on the person's own
  token, opt-in and kept encrypted in the control plane, with their
  notifications as the wake-up; private repositories take a second,
  read-only token (§6.1). The App stays the main path; sessions and
  `archive/github-app-install.md` are unchanged (#271).
- `design/foundations/protocol.md` said the browser never reaches the runner
  directly, every byte going through the relay. On 2026-10-11 the owner
  made the session's latency the priority: `design/runner/direct-terminal-path.md`
  adds a WebRTC data channel from browser to runner, started after the
  relay path and falling back to it (built the same day, behind the
  `terminal_direct_path` flag), and the console now draws predictable keys
  before their echo. The relay still admits every attachment.
- `design/runner/direct-terminal-path.md` bound the direct channel to the
  DTLS fingerprints in the signalling, which the control plane relays, so a
  compromised control plane could sit in the middle of it. On 2026-10-31 the
  owner asked for as much peer to peer as possible and a handshake to harden
  it: `design/runner/peer-to-peer-and-the-host-proof.md` has the host sign
  both fingerprints with its pairing key on every channel, the browser pin
  the key per host, and orders what moves off the control plane next.
- `design/console/screens.md` said a deleted session's row stays until
  the host confirms the close. On 2026-10-11 the owner asked for delete
  to feel immediate: the row leaves on the click and comes back only if
  the close cannot happen. A session removed on its host (by hand, or by
  `runner sessions close`) now closes on Delete or Restart instead of
  being stuck for ever.
- `design/console/screens.md` said selecting text needs Shift-drag
  (Option-drag on macOS), because tmux owns plain drags. On 2026-10-11
  the owner could not copy a plain-drag highlight: tmux copied it to its
  own buffer and the console dropped the OSC 52 that carried it out. tmux
  now runs with `set-clipboard on` and the console writes OSC 52 to the
  clipboard (writes only, never reads), so a plain drag copies on release.
- `design/console/screens.md` had onboarding's Add a host step and the
  console's Add a host dialog lead with Copy install command and Copy
  agent prompt, the instruction behind an Inspect fold and one status
  line. Since 2026-10-13 both lead with the agent prompt (Copy prompt, the
  text behind a fold), fold the command behind "Install manually instead"
  and show a Connection list: Runner installed, then Host connected. The
  export's Tools on PATH row waits for the wire to carry a host's tools.
  Settings' Add a host page keeps the panel with both forms.
- `design/pull-requests/pull-requests.md` (version 1 scope, 2026-10-05) put a
  summary agent's brief on every pull request, and the 2026-10-05 frames
  opened one on a Briefing with a lane switcher and a review session. On
  2026-10-13 the owner took the 2026-10-13 frames without their chat,
  review agent or Employees: a pull request is **Description and
  Changes**, the description is the author's own beside the rail (merge
  status, comments, reviews, checks), and there is no generated summary
  until the chat comes (0.7). The frame's status strip above the
  description was built and dropped the next day for the rail. The queue filters by repository,
  Difficulty, Checks and Waiting in a fixed order (Deep first, then the
  longest wait); Submit review splits **Approve** from **Approve and
  merge**, which turns on GitHub's auto-merge when it cannot merge yet;
  the activity timeline, the Briefing and the Merge confidence
  score are gone; watched repositories are set in Settings only
  (`design/pull-requests/pull-requests.md`, "The screens as built").
  On 2026-10-14 the review session came back without the review agent:
  a pull request's **Chat** tab starts Claude Code on one of the reader's
  hosts, in a worktree of the head branch, on a prompt that opens with a
  two-or-three-line take and waits, and then shows its terminal with an
  input line under it; review sessions are listed under **For review** in
  the Pull requests sidebar and never under Sessions. That is §4's *Check
  out in a session* decided as 0.2.
- `design/foundations/api-modules-and-data-model.md` held a project to at
  least one repository, and the console would not save one without (the
  2026-09-26 line above). On 2026-10-14 the owner allowed a project with
  no repository: it is a place for tasks, milestones, memory and sessions,
  and folder and terminal sessions need none. A project that holds
  repositories still offers a default among them (`PROJECTS_006`). The
  Unassigned project keeps that name.
- `design/console/screens.md` opened New session on the `full`
  permission level every visit and never remembered it. On 2026-10-14 the
  owner made it open on `auto` and remember the last level picked, like
  the other chips.
- `design/console/screens.md` never remembered New session's repository
  and branch, and let the landing project's default host, agent and
  repository replace the last visit's choices. On 2026-10-22 the owner made
  every chip open on its last choice: the scope is remembered, and the
  landing project fills only the chips the memory left empty. Picking a
  project on the screen, or naming one in the address, still applies all
  its defaults.
- `design/foundations/scope.md` made every session a worktree, the blank
  terminal included, under `~/oppenheimer-ai/workspaces/<repo>/`. On
  2026-10-14 the owner made the place a choice, a new worktree or a folder
  already on the host, and moved the runner's work to `~/oppenheimer/`
  as `<account>/<workspace>/{repos, agents, sessions}`
  (`design/sessions/session-places.md`). The same day the account level's
  name was settled as the id the runner receives when it is paired
  (`POST /hosts/register` answers it), so `session.create` and
  `repository.prepare` carry the workspace only (`design/sessions/session-places.md` §2, §5).
- The agent catalog mapped Claude Code's `auto` level to
  `--permission-mode acceptEdits`, which prompts on every shell command,
  and review sessions launched at `ask` (both left open in
  `design/automations/automations-architecture.md` and
  `research/headless-runs-draft.md`). On 2026-10-15 the owner made `auto`
  Claude Code's own auto mode (`--permission-mode auto`), which checks each
  action before it runs, and made it the level review sessions start at.
- A session started from a task's Start session dialog launched its agent
  at `full` (`--permission-mode bypassPermissions` for Claude Code). On
  2026-11-05 the owner made it start at `auto`, as every other session
  does; `full` stays a choice in the new-session form.
- On 2026-10-16 the owner dropped the review session's input row, which
  doubled the agent's own prompt; the Chat tab is now the plain session
  pane (`design/pull-requests/pull-requests.md`).
- `design/bots/bots.md` ran a bot as a headless turn on its home host;
  on 2026-10-15 its loop moved into Oppenheimer (`design/bots/bots.md`, "Decided").
- `design/bots/bots.md` let a bot keep Claude Code's `WebFetch` and subagents. On
  2026-10-15 both were turned off: the fetch reached the server's private
  network, and subagents searched the server's disk (`design/bots/bots.md`, "Decided").
- `design/bots/bots.md`'s system prompt was the bot's soul, instructions and memory. On
  2026-10-15 it became ours from the first line, with a closed list of
  what the bot can do and the sender's time, home host and hosts, and a
  turn stops after 4 minutes (`design/bots/bots.md`, "Decided").
- `design/bots/bots.md` had a bot save to the general memory only what it happened to
  notice, and a new bot asked for its job without saying what it could do.
  On 2026-11-10 every turn asks what it learned about the person, for the
  general memory, and a new bot's greeting lists what it can do from the
  tools its turn offers (`design/bots/bots.md`, "Decided").
- `design/bots/bots.md` gave a new bot a calm, flat `SOUL.md` and a first name it kept.
  On 2026-11-10 the soul became friendly and proactive, after OpenClaw's
  default, and the first name a placeholder: its first chat asks the
  person what to call it (`design/bots/bots.md`, "Decided").
- `design/bots/bots.md` ran bots on three providers, each on a workspace's API key. On
  2026-10-15 ChatGPT became a fourth, signed in with a ChatGPT subscription
  through OpenAI's device code flow, the way OpenClaw and the Codex CLI do
  (`design/bots/bots.md`, §2 and "Decided").
- `design/bots/bots.md`'s system prompt ended with the moment the turn ran in: the
  sender's time, the home host and the hosts. On 2026-10-15 that moved to
  a `<turn_context>` block opening each turn's message, so the system
  prompt is the same bytes every turn and the provider's prompt cache
  hits (`design/bots/bots.md`, "Decided").
- `design/bots/bots.md` sent a turn the bot's last 40 messages and dropped everything
  older without a word. On 2026-10-15 history became a token budget
  (24,000 tokens) opened by a stored summary of the older messages, which
  a `bot-summaries` job writes with the bot's own model once they pass the
  budget with headroom (`design/bots/bots.md` §2, "Decided"). The chat still shows every
  message.
- `design/bots/bots.md` named a bot's last settings page Runs on (Works on from slice
  3), and its picks, the colour and sidebar group on Profile included,
  saved on the click. On 2026-10-16 the owner, testing it, read Runs on as
  where the bot runs: the page is **Home host** now, says the bot always
  runs in Oppenheimer and the home host is only where its sessions start
  when no machine is named, offers No home host, and every bot settings
  page saves a draft with Save (`design/bots/bots.md` §1, "Decided").
- `design/bots/bots.md` named a blank bot "New Bot" and had it ask for its job in one
  line. On 2026-10-16 a blank bot takes the next of twenty first names
  ("Juno", "Milo"…), and its first chat walks it through learning one
  job, writing its own INSTRUCTIONS.md and description, and offering a
  first task (`design/bots/bots.md` §1, "Decided"; `research/lessons-from-grok-bot.md` §6).
- `design/plan/plan-milestones-stats-accounts.md` ran a project's
  milestone bar on to ten days past its last milestone, which read as the
  bar overshooting the dates. On 2026-10-15 the owner had it end on the last
  milestone's day, as a timeline bar does in Notion; the three-week lead-in
  before the first milestone or today stays (`design/plan/plan-milestones-stats-accounts.md` §1).
- `design/runner/runner.md` §10 said an agent CLI that is not installed is
  left alone and that OpenCode is never updated, because its updater asks.
  On 2026-10-12 the runner learned to install agent CLIs and `gh` when the
  person asks (`runner agents install`, `runner tools install gh`), user-level
  and without sudo, from install entries in the catalog; and OpenCode joins
  the hourly updates, told its install method so it does not ask. `git` and
  `tmux` stay with the package manager. The host installer now asks which
  agent CLIs to install, defaulting to Claude Code and gh, so the Add host
  command leaves a host ready to run a session (`design/runner/runner-install-and-update.md` §2).
  Developing Oppenheimer itself on a new machine is one command,
  `scripts/dev/bootstrap.sh`, with `mise.toml` pinning the toolchain.
- `design/runner/runner.md` §10 (2026-10-12) installed Claude Code and
  OpenCode by running their vendors' install scripts, fetched to a file
  first but checked by nothing. On 2026-10-17 Claude Code installs from its
  latest release binary instead, verified against the SHA-256 in that
  release's manifest before the binary runs its own `claude install`, and
  `gh` shares the same check; no Claude Code script runs. OpenCode keeps
  its script for now, because its releases publish no checksum for the CLI
  (`design/runner/runner.md` open question 11).
- `design/console/voice.md` planned slice 3 as the task dialog, the terminal
  paste, a hotkey and a dictionary, and said the recorder's `AudioWorklet`
  would come when it moved to the kit. On 2026-10-17 the owner asked for
  dictation in every prose input as one shared piece: the fields shipped
  first (the kit's `dictation` concern), the rest stays for later, and the
  recorder kept `ScriptProcessorNode` ("Dictate everywhere as built").
- `design/console/voice.md` said the polish is skipped when the raw transcript
  is clean and short, and that the ChatGPT route's names reach it only
  through the polish. On 2026-10-18 (#393) every clip is polished, with a
  light-touch brief modelled on Wispr Flow, and the names also go to an
  OpenAI-compatible speech server as its `prompt` ("Dictation quality,
  first pass").
- `design/console/voice.md` shipped `voice_dictation` as a release flag,
  default off. On 2026-10-18 it became an `ops` flag defaulting to `true`,
  the feature's kill switch.
- `design/runner/runner-install-and-update.md` had `runner uninstall` exit 0 when the control plane could not
  be told, with a hint naming `DELETE /v1/hosts/{id}` and no console
  control. On 2026-10-18, after an owner's uninstall hid a failed
  revocation (issue #394), it exits 7 (`PAIR_009`), prints the underlying
  failure, and points at Settings → Hosts → Remove or
  `DELETE /api/v1/hosts/{id}`; `register` on a paired host names both
  origins and the commands that move it (`design/runner/runner-install-and-update.md` §4).
- `design/runner/hosts-settings.md` had removing a host only stop its
  sessions, every checkout kept. On 2026-10-18 the owner, testing on a
  host, asked for a way to stop everything and start again: the remove
  dialog has an "Also delete everything on this machine" box, and an
  online host then closes every session, worktrees removed and nothing
  pushed (`design/runner/hosts-settings.md`, "Remove can also clean the machine up").
- `design/foundations/control-plane.md`'s hello reconciliation sent again only a launch the host never
  carried out, so a close lost with a dropped link was never re-sent and a
  deleted session came back in the console. On 2026-10-18 the fold keeps a
  close owed (and the host's refusal of it) as columns, the hello sends an
  owed close again, a restart request supersedes it, and the console draws
  such a row as deleting or refused instead of bringing it back as it was
  (`design/foundations/control-plane.md`, "A close is owed until the host answers it"; `design/foundations/protocol.md`, "Hello").
- `design/foundations/control-plane.md` keyed the `session.stopped` a hello records for a lost pane by the
  runner's `runId` alone, so a replayed hello wrote it once. That also
  merged a second loss of the same pane, after a restart, on a later link of
  the same runner process, into the first, and the session stayed open on a
  pane that was gone. On 2026-10-31 the key is the run and the link's epoch,
  and the entry is written only while the row is still open and not stopped
  under its lock (`design/foundations/control-plane.md`, "Hello reconciliation").
- `design/bots/bots.md`: a bot with no provider named, or on one with
  no key, fell back to the first keyed provider in catalog order, so a
  workspace with GLM and ChatGPT opened its bots on GLM. On 2026-10-18 the
  owner asked for ChatGPT instead: the fallback order is Anthropic,
  ChatGPT, OpenAI, GLM (`BOT_PROVIDER_PREFERENCE`).
- `design/bots/bots.md` had `ask_bot` give another bot a task and wait for its answer.
  On 2026-10-18 it was built so the answer comes back as a new turn of the
  asker instead: one turn per bot runs at a time and a turn has four
  minutes, so an ask that waited could time out or leave two bots waiting
  on each other. The sender is recorded rather than claimed, messages
  holding a credential are refused, and the chain is decided under a lock,
  from `research/agent-coordination-experiments.md` (`design/bots/bots.md` §4.6, "Decided").
- `design/runner/runner.md` §10 (2026-10-17) kept OpenCode on
  `opencode.ai/install`, which checks nothing, and its hourly update on
  `upgrade --method curl`, which reruns that script. On 2026-10-18 the
  owner, answering the review's "verify downloaded vendor installers",
  moved it to its npm package `opencode-ai` under `~/.local`, checked
  against the registry's integrity hash as Codex and Grok are, so no agent
  install runs a script it downloaded. Its update is `--method npm`, with
  npm pointed at the prefix the executable lives under; an OpenCode in
  `~/.opencode/bin` is left to its own autoupdate (`design/runner/runner.md` open question 11,
  "Decided").
- `design/bots/bot-routines.md` decided on 2026-10-16 that bot
  routines had no spend guard: the run budget and the overlap guard held
  the cost. On 2026-10-18 the owner asked routines to behave as Grok
  Bot's do, and the guard is back: a nudge, then a pause of every routine
  of the bot when nobody reads what they say. In the same review the
  bot's routine tool lost its per-action table for one consent rule
  (only `list` and `pause` run without a card), and routine changes,
  runs and failures became one activity event written by one listener
  (`design/bots/bot-routines.md` §4, §6, "Decided").
- 2026-10-18, building bot routines' slice C: a routine's activity lines
  belong to no turn, so a turn's several changes are not folded into one
  "Routines in this change" group yet, and a routine turn that failed is
  shown by its turn rather than by a second `failed` notice (`design/bots/bot-routines.md` §4 "In the
  chat", "Decided").
- `design/bots/bots.md` §4.4 (2026-10-15) built the GitHub reads only,
  and a bot told its owner it could not merge a pull request it had
  reported ready. On 2026-10-20 the asking writes of the table were built
  (comment, review, merge, review session), and issues were added to the
  table: `list_issues`, `get_issue`, and the asking `create_issue` and
  `comment_on_issue`, under the `pulls:*` scopes and the App's new Issues
  permission. A bot's merge is pinned to the head its card showed.
- `design/bots/bots.md` §4 said a bot "can never do more than the
  person who owns it may do", but no tool checked the owner's roles: only
  a token's scopes narrowed a turn. On 2026-10-20, after the review of the
  pull request writes, the owner's live roles are checked on every call
  and every approved run; a tool they lack stays offered and its call is
  refused, naming the permission to ask for (`design/bots/bots.md` §4).
- `design/runner/runner.md` §5 (2026-10-18) marked a session's folder
  trusted in Claude Code only for a launch at Approve for me or Full
  access, leaving Ask on "do you trust this folder?". On 2026-10-20 the
  owner asked for every session to start pre-trusted: the runner marks
  the folder before every launch and restart, whatever the permission
  (`design/runner/runner.md`, "Every launch starts in a trusted folder").
- The MVP decided "the session view stays a terminal; the Agent SDK stays
  out". On 2026-10-21 a proof of concept added a chat view beside it,
  behind `session_chat_view`: the terminal is still the session view and
  the agent still runs unmodified in tmux, and the chat is read off the
  agent's own transcript, which the runner follows while a browser is
  attached; nothing drives the agent but the PTY
  (`design/sessions/terminal-and-chat.md`, "Proof of concept").
- `design/bots/bots.md` §7 listed attachments as not built. On
  2026-10-21 (issue #426) images were built (§3.1): a bot on Anthropic,
  OpenAI or ChatGPT reads PNG, JPEG, GIF and WebP sent with a message; GLM
  refuses them. Other files stay unbuilt.
- `design/bots/bots.md` §1 (2026-10-15) gave a bot a closed list
  ending "no shell, no files … say so and stop", so a bot asked to run a
  build turned it down though `start_session` would do it. On 2026-10-21
  a turn that may start a session gets a "Working on code through
  sessions" section: code work goes to a coding agent on a host, the
  closed list points there, and a turn without the tool keeps the plain
  refusal (`design/bots/bots.md` §1, "Decided").
- `.agents/rules/feature-flags.md` and the catalog had a new feature's flag
  default to `false`, with `true` only for a kill switch over something
  live. On 2026-10-22 the owner asked for every flag to be on by default:
  every boolean flag's `defaultValue` is `true` and `pnpm check:flags`
  fails one that is not, so `workspace_event_stream`,
  `terminal_direct_path` and `session_chat_view` now serve on until
  targeting turns them off or narrows them. `scripts/evals/feature-flags/`
  checks that an agent launching a feature follows it.
- `design/channels/slack-sessions.md` was the Slack integration on its own. On
  2026-10-22 bots gained channels (`design/channels/channels.md`): WhatsApp,
  Slack and email behind one interface, with WhatsApp first as a linked
  device of a number the owner has. Slack as a way to reach a bot is now
  that note's Slack channel; 0.4 keeps its questions about sessions.
- `design/channels/channels.md` bound each channel account to one bot; on
  2026-10-24 routes replaced that (`design/channels/customers-and-routes.md`).
- `design/channels/channels.md` put WhatsApp first and email as a mailbox you
  own; on 2026-10-29 email came first, as an address of the bot's own,
  and the same day reading your own mailboxes went ahead of every channel
  (`design/channels/mail.md`), narrowed to Gmail with drafts and sends.
- `design/channels/mail.md` §3.4 planned a send's files from the bot's chat,
  its documents and its turn as well as from mail; slice 2 (2026-10-29)
  sends files from mail only, and a draft is answered in the chat as text
  with its Gmail link rather than a card (mail.md, "Decided"). The same day
  the chat's images became attachable and the draft got its card; the
  bot's documents and a turn's files stay out (mail.md, "Decided").
- `design/bots/bots.md` §4.7 planned `delegate` as a subagent for a
  long job whose result arrived later as a message. On 2026-10-22 (issue
  #444) it was built as subagents inside the turn: up to 4 read-only
  children in parallel, bounded and stopped with the turn, whose answers
  the bot reads as data and answers from in the same reply (`design/bots/bots.md`, "Decided").
- `design/bots/bot-routines.md` decided on 2026-10-16 that "when a
  session ends" reaches a bot only as a routine's trigger, with no watch
  table. On 2026-10-22 (issue #445) the owner asked for a bot to subscribe
  to the sessions it delegates, as Grok Bot's watchers do, and to be woken
  when they finish, fail, are stopped or need input. A
  `bot_subscription` now follows one session for the bot that started or
  watched it, and every wake is still a queued turn
  (`design/bots/bot-subscriptions.md`, `design/bots/bot-routines.md` §5).
- `design/sessions/terminal-and-chat.md` had the relay never send the chat
  through a share link, so a guest saw only the terminal. On 2026-10-23
  the owner asked for the shared page to have the chat view too: the
  relay judges the flag as the sharer, and the guest gets Terminal / Chat,
  read-only on a read share (0.7, "Wire").
- The console used to open on New session (`/sessions/new`) with Sessions
  first in the rail. On 2026-10-25 Employees moved to the top of the
  rail's default order, and the console opens on the rail's first item,
  so a reader who drags another item to the top opens there instead
  (`design/console/screens.md`, `design/bots/bots.md`).
- New session's chips used to sit in a grey band fused to the top of a
  tall composer, under a line saying what sending would do. On
  2026-10-26 it became one box at the pane's foot with a row of choices
  under it and the project over it, and a session's name, state, Terminal
  / Chat and Share moved from the terminal's status line to a bar over it
  (`design/console/screens.md`).
- `design/bots/bots-in-sections.md` decided on 2026-10-26 that only
  Pull requests opens a bot's chat inside the section, and that Sessions,
  Automations and Plan send the reader to Employees, as the export's frames
  link them. Later that day the owner, clicking a bot in Sessions, asked to
  stay on the page: every section now opens the chat in place, under its
  own address and sidebar (`design/bots/bots-in-sections.md`, "Decided").
- New session's Where and Host were two chips. On 2026-10-26 the owner
  asked for the export's one chip, the host and where on it ("mac-studio ·
  New worktree", the hosts and a Start in pane per host); the box took a
  session chat's height, and the models dropped "Claude" from their names
  ("Opus 5.5") (`design/console/screens.md`).
- `design/foundations/scope.md` said, from 2026-09-23 (#56), that a session
  checks out one repository, because the runner made one worktree per
  session and refused a create with two. On 2026-10-26 the owner lifted the
  cap: the runner makes one worktree per checkout, each in its own directory
  of the session folder, and a session checks out up to five repositories
  (`MAX_SESSION_CHECKOUTS`), the first being where the agent starts unless
  another is named. The bound exists because each checkout is a clone and a
  worktree on the host, and the picker has to stay readable. `SESSIONS_010`
  keeps its code and refuses a repository added to a running session,
  since the wire cannot add a worktree to a live one. Recorded in `design/foundations/scope.md` and the MVP
  decision log.
- The preview pane the session frame opens beside a terminal was not
  built. On 2026-10-26 the owner asked for the Simulator in it: a
  session's host offers simulators and emulators (`RUNNER_DEVICES`), each
  session holds one, its agent drives it through Argent and the reader
  watches and taps it in the pane, its screen relayed over the link as one
  more attachment kind (`design/console/screens.md`,
  `research/device-streaming.md`). The Browser tab is still not built.
- `design/console/inbox.md` §4 had the cross-bot approvals read list the
  bots the caller may update. Built on 2026-10-26, it lists the bots the
  caller may read, as the per-bot read it mirrors does; deciding a card
  still asks `update`.
- `design/console/inbox.md` §3 keyed a session by `observedSince`, which
  only a blocked agent has. Built on 2026-10-26, a failed or stuck launch is
  keyed by its lifecycle's change count (`stateSeq`) instead, and the API
  added both fields to a session and `headSha` to a pull request row.
- `design/console/inbox.md` §5 and Decided 1 made the Inbox the rail's
  first item at `/inbox`, with its list in the console's sidebar and the
  item in hand as a card under a greeting and a log. The 2026-10-29 export
  moved it into Plan, and on 2026-10-29 the owner asked for it to look
  like a mail inbox: it is Plan's first section at `/plan/inbox` (the old
  address redirects), the rail item is gone, the console still lands on it,
  and the pane is a list column (search, unread rows with sender, subject
  and a line of body) beside a reading pane (a toolbar, the item as a
  message). The log is gone with the greeting; Show done is the record.
- `design/pull-requests/pull-requests.md` §6.1 (2026-10-08) pictured one
  notifications token and one optional token for private repositories. On
  2026-10-26 the owner asked for several organisations and, inside one, a
  token per repository if need be: a person adds any number of tokens, each
  opens whatever repositories GitHub says it does, and each repository is
  read with one key chosen at read time (the App, else a pinned token, else
  the narrowest). The notifications wake-up is left for later (§6.2).
- Preview URLs were parked after the MVP (`archive/mvp.md` §9). On 2026-10-27
  the owner asked for the Browser tab, through "tunnel technology like
  Cloudflare, Vercel or ngrok"; offered the runner's own link as that
  tunnel, they chose it, asking that an app with an API work. A preview is
  an origin per session and port on a preview domain of its own, served by
  the relay through the link, the app seeing `localhost` and its API behind
  the dev server's proxy; cloudflared and ngrok wait for public share links
  (`design/sessions/session-previews.md`).
- `research/cloud-agents.md` §5 proposed a cloud session as a third
  place of `work_session`. On 2026-10-26 Cursor's cloud agents landed as
  their own module and table instead, since a vendor's agent has no host,
  terminal or checkout to fold (`design/sessions/cloud-agents.md`), and F23
  gained a line saying a vendor API key the control plane uses itself is
  not the subscription sign-in it forbids (`archive/security-review.md`). On
  2026-10-27 the owner asked for cloud sessions where the other sessions
  are, chosen in New session's place picker, and §5 came back: a cloud
  session is a `work_session` in place `cloud` with no host, its vendor
  run beside it in `session_cloud_run`, its row in the sidebar opening
  the vendor (`design/sessions/cloud-agents.md`, `design/sessions/session-places.md`).
  On 2026-10-28, with Claude Code's cloud on `main` as the same place
  started by a host, the owner kept both: two kinds of the one `cloud`
  place, with a host or without, and Grok's to come
  (`design/sessions/cloud-agents.md`, "Two kinds of cloud session").
- Bots ran on Anthropic, GLM, OpenAI and ChatGPT. On 2026-10-26 Grok (xAI)
  joined them on the OpenAI engine (`design/bots/bots.md`).
- `design/bots/bots.md` §4.2 planned `read_session` as "a session's
  recent output". Built on 2026-10-27 (issue #493), it reads the session's
  event log in words, never the terminal or the agent's conversation, which
  stay on the host; `send_to_session` came with it, gated on the agent
  waiting at its prompt and logged with the bot as sender, and so did
  `answer_session`, which the table did not have. On 2026-11-07 a bot
  answered only what its instructions settled; on 2026-11-10 it unblocks
  the sessions it follows itself. That day a destructive approval was first
  always a card; the owner then made it the bot's preset's call: Full access
  acts on its own with its reasoning, Approve for me asks
  (`design/bots/bots.md`).
- `research/cloud-agents.md` §5B ordered cloud places Cursor first, then
  Claude, and said Claude would give no status. On 2026-10-27 the owner
  asked for Claude end to end first: a `cloud` place started by the host's
  runner with `claude --cloud`, and its status reported from claude.ai by
  `apps/extension` (`design/sessions/session-places.md` §7,
  `design/sessions/cloud-agents.md`).
- `design/console/screens.md` had an empty project show in the sidebar
  with an empty row and a link to start a session. On 2026-10-28 the owner
  asked for the sidebar to list only projects that hold sessions: an empty
  project is not drawn (New session and the project filter still reach
  it), and a sidebar with projects but no session says so in one line.
- `design/bots/bots-in-sections.md` had a section's Bots plus make a
  blank bot placed there, and placing or hiding any other bot happen in its
  Settings → Profile. On 2026-10-28 the owner asked to manage each page's
  bots from the page: the plus opens a menu with New bot and a check per
  bot for this section, and a row's ellipsis hides it from the section
  (slice D).
- `design/sessions/session-places.md` §7 had Claude Code's cloud only as a
  place in a host's Start in pane. It is now also the Claude Code row under
  Cloud, which picks a host that can start it (2026-10-28).
- `design/sessions/session-places.md` §7's Claude Code row picked the host
  for the reader. It now opens a *Start from* pane where the reader picks
  any host that can, and the engine button offers only Claude Code's models
  in that place (2026-10-28).
- Grok offered sessions 4.7 and 4.6 with six effort levels, `minimal` to
  `max`, and bots 4.7 and Grok Build 0.1 starting on `medium`. On
  2026-10-28 the owner asked for a better Grok catalogue: sessions offer
  4.7, 4.6 and 4.5 and bots add 4.6 and 4.5, each with the levels its own
  menu has (grok 1.0.70 refuses the rest; 4.5 stops at high), `high` the
  default everywhere (`design/console/screens.md`,
  `design/bots/bots.md`).
- 2026-10-28 the owner asked for images in the chats to look and open the
  way Claude's own chat shows them: a bot's images open in a viewer over
  the chat instead of a new tab, and a session's chat, which only counted
  pasted images, now shows them and the screenshots the agent reads, from
  a preview the runner sends within the link's entry bound
  (`design/sessions/terminal-and-chat.md`, `design/bots/bots.md`).
- `design/sessions/cloud-agents.md` had cloud sessions start from New session
  alone. On 2026-10-29 the owner asked for them in Plan's tasks and in the
  automations: Start session and an automation's revision pick where the
  session runs (on a host, Claude Code's cloud from a host, Cursor's with no
  host), and a run with no key for its vendor pauses the automation
  (`cloud_key_missing`; `design/sessions/session-places.md`,
  `design/plan/plan-product.md`, `design/automations/automations.md`).
- `design/sessions/cloud-agents.md` had a Claude Code cloud session take a task
  and nothing else: a first task's files are saved on the host, which the
  cloud never sees, so the console dropped them. On 2026-10-29 the owner
  asked for them to reach the cloud's agent. The API keeps them in its
  storage under the session, and the task ends with a `curl` line per file
  on a short, day-long link served by the API
  (`GET /v1/cloud-files/{token}`), minted again on every launch; the
  environment's network policy has to allow the API's host
  (`design/sessions/cloud-agents.md`, "Files for a cloud session").
- 2026-10-28 the owner asked for bots to send images back: `show_image`
  fetches an image from the web by its address (the only images a bot,
  which has no files, can reach), stores it as the chat's own and draws it
  in the bot's answer (`design/bots/bots.md` §4.7).
- `design/sessions/session-places.md` §2 put a workspace's stores and
  sessions in `repos/` and `sessions/`, and kept Spotlight out with
  `.metadata_never_index` at the work folder's root. The MVP decision log
  had already measured that marker as not working (2026-10-01), and the
  hidden `.worktrees/` that did work was lost with the move to the work
  folder: on a Mac host every session's checkout, `node_modules` included,
  was indexed again. On 2026-10-28 the two directories became
  `repos.noindex/` and `sessions.noindex/`, the suffix Spotlight skips (as
  Xcode's DerivedData and Orca do), layout version 3, with no migration
  (`design/sessions/session-places.md` §2).
- A bot's tool answer was cut to its first 12,000 characters. On
  2026-10-29, from Grok Bot's harness (`research/lessons-from-grok-bot.md`
  §9), it keeps its start and its end within that, since a session's
  error is at the end; and a failed turn records a kind, so the chat no
  longer offers Retry where the same message fails again
  (`design/bots/bots.md` §2–§4).
- A bot's permissions are set in Settings → Permissions, tool by tool, and a
  yes on a card can reach past its call: *Always allow for* the repository,
  project or session it acts on, or *Always allow* for the tool; merging
  stays per call. Plain-language rules are read by a reviewer on the bot's
  own model before an asking call, an ask rule winning and a failed review
  asking. 2026-10-29, from Grok Bot's approvals
  (`research/lessons-from-grok-bot.md` §9 rows 6 and 7;
  `design/bots/bots.md` §5).
- 2026-10-29 the owner asked to see a bot's subagents while they work:
  "Running 3 subagents" now has a line per child under it (its task,
  waiting or running with its clock or how it ended, the tools it has
  called so far), from frames the bot's stream sends each time one moves,
  until the stored line replaces them (`design/bots/bots.md` §4.7).
- 2026-11-06 the owner asked to see a session's subagents the way the
  terminal's footer lists them: Claude Code's, Codex's and OpenCode's
  subagents now send their own work beside the transcript, and the chat
  hangs each under the call that started it, a row with its task, kind,
  model, clock, tokens and what it is doing, that opens to its work.
  Grok's stay a row with no work under it (`design/sessions/terminal-and-chat.md`,
  "Subagents").
- 2026-10-29 the owner asked for Codex cloud tasks the way Claude Code's
  cloud works, though the research note put Codex cloud last: a Codex row
  under Cloud starts the task from a host with `codex cloud exec`, and the
  host, not the browser extension, reports its status off
  `codex cloud list --json`, since Codex's CLI answers it
  (`design/sessions/cloud-agents.md`, `design/sessions/session-places.md` §7).
- `design/sessions/cloud-agents.md` had a Codex environment named neither for
  the repository's full name nor its bare name be the CLI's refusal, in its
  words (`SESS_009`). On 2026-10-31 starts failed "not found" on
  environments made in ChatGPT Settings → Codex Cloud, which codex-cli
  0.166.0 cannot reach (it resolves only the list `codex cloud` browses).
  That is now `SESS_010`, naming the labels tried and the labels on the
  account's recent tasks, the one non-interactive view codex-cli offers,
  partial; the failed start's pane explains it with a link to Settings →
  Codex Cloud. The place picker does not mark the Codex row for it, since
  a partial list would hide starts that work
  (`design/sessions/cloud-agents.md`, "Environments the CLI cannot reach").
- A bot's watch woke it only on a task's state. On 2026-10-29, from Grok
  Bot's shell watches (`research/lessons-from-grok-bot.md` §9 rows 8 and
  9), it can also wake on a line the terminal prints that matches a
  pattern. The runner matches it on the host and sends only a count, so
  pane text still never reaches Postgres. A bot can also wait up to 120 s
  inside its turn, and read a session's log from the entry its own input
  followed (`design/bots/bot-subscriptions.md` §2,
  `design/bots/bots.md` §4.2).
- Row 10 of `research/lessons-from-grok-bot.md` §9 placed goals in `design/bots/bot-routines.md`
  as a routine the bot sets on itself. On 2026-10-29 they were built
  instead as a goal of their own in `design/bots/bots.md` §4.1. A
  routine's run is a schedule's slot, but a goal goes on when the bot's
  last turn ends. So it is a bounded count of continuation turns, at most
  `design/foundations/api-modules-and-data-model.md`, keyed in the turn queue like a wake, with Stop above the composer.
- `design/bots/bots.md` §7 listed user memory as not built. On 2026-10-29, from Grok
  Bot's memory (`research/lessons-from-grok-bot.md` §9 row 11), a fact
  gained a tier (in the prompt, or looked up with `recall`) and a scope
  (the bot's, or about the person and read by all their bots), on the same
  table (`design/bots/bots.md` §4.1). Project memory stays in §7.
- `design/bots/bots.md` §4.7 listed `ask_user` as a question card with no design. On
  2026-10-29, from Grok Bot's form cards (`research/lessons-from-grok-bot.md`
  §9 row 12), it was built as a card of up to four questions, a card of its
  own beside approvals that is answered or dismissed and never approved,
  with one card of either kind up per bot (`design/bots/bots.md` §3.2).
- Row 14 of `research/lessons-from-grok-bot.md` §9 placed CI findings in
  the review session's result. On 2026-10-29 they were built as a bot's
  tool, `record_ci_findings`, filed on the pull request's head and shown
  with its checks (`design/pull-requests/pull-requests.md`, "CI findings"). A
  review session has no channel back to the control plane yet
  (`review.report` is unbuilt).
- 2026-10-29 the owner asked for bots to be dragged into order on every page
  that shows them. There is still one order, the Employees order, and no
  per-page one: a section's Bots heading now drags its rows too, and a drop
  there moves the bot in Employees (between the same two bots, keeping its
  group when a neighbour is in it), so every heading follows. The bots list
  the API serves is that order (groups by position, then Ungrouped); it had
  been Ungrouped first with groups by id, so a heading's order differed from
  Employees' (`design/bots/bots-in-sections.md`, Decided).
- `design/bots/bot-subscriptions.md` §2 had `queued` and `in_progress`
  never wake a bot, so a delegated task stuck before it began (its host
  offline, its agent at a folder-trust or sign-in prompt) left the bot
  silent until somebody asked. On 2026-10-29 the owner asked for it to
  "monitor a bit what it has done", and chose, over a progress update
  (which Grok Bot, Codex and Claude Code do not send), a silent stall
  check: five minutes after `start_session` or `send_to_session`, a job
  reads the task and wakes the bot once, as `stalled`, only if it never
  started or its agent was never seen working (`design/bots/bot-subscriptions.md` §4.1).
- `design/bots/bots.md` §4.1 (2026-10-29) had a goal end only when the
  bot called `end_goal`, the owner stopped it, a turn of it failed or its 5
  continuations (up to 10) ran out. On 2026-11-02 the owner asked for bots
  to come with basic commands like Claude Code's `/goal`, in the order
  `/goal`, `/usage`, `/loop` or `/schedule`, `/plan`, `/grill-me`. They are
  built-ins, product code with reserved names, not skills. `/goal
  <condition>` sets the goal as the person, and a reviewer on the bot's own
  model judges it after every turn (met, not met, impossible), as Claude
  Code's evaluator does; a person's goal takes up to 20 continuations, a
  bot's 5 unless it asks for up to 20 (`design/bots/bots.md` §4.1, "Built-in commands").
- `design/bots/bot-routines.md` §4 (2026-10-18) had every routine
  save by the bot ask the owner first, except on the Routines tab. On
  2026-11-03 `/schedule <request>` was built (`design/bots/bots.md` §4.1): the bot saves the
  routine the person's command asks for, and that one create raises no
  card, since the command is the consent. Changes, deletes and runs still
  ask.
- `design/bots/bots.md` §4.1 (2026-11-02) planned `/loop` or
  `/schedule` as a routine of the bot's (`design/bots/bot-routines.md`). On 2026-11-03 the owner chose
  `/loop`, and it is its own built-in instead: routines run on a calendar
  and last until deleted, while a loop runs every few minutes (1 minute to
  1 day, or when the bot chooses), belongs to the chat it was typed in and
  expires after 3 days. `/schedule` stays planned as a routine (`design/bots/bots.md` §4.1).
- `design/bots/bots.md` §4.1 (2026-11-02) drew `/usage` as three lines
  of this chat's figures and left the context and plan windows to the
  composer's meter. On 2026-11-03 the owner asked for a card like Claude
  Code's small usage card, and smaller: the command as a bubble, then a
  384px card with the plan's 5-hour and weekly windows as bars, this chat's
  figures in a grid and the tokens' breakdown (`design/bots/bots.md` §4.1).
- 2026-10-31: the owner took the six chat slices drawn from a read of Codex
  and Grok (`research/lessons-from-codex-and-grok-chat.md`); they are listed
  in `design/sessions/chat-protocol.md`.
- `design/bots/bots.md` §5 (2026-10-15) had every no on a Needs input
  card give the bot a turn that tells it, so it always carried on. On
  2026-10-31 the card took Codex's `available_decisions`: the API chooses
  the decisions a card offers (approve, approve for its subject, always
  allow, deny, deny and stop) and accepts only those. *Deny* still gives
  the bot a turn; *Deny and stop* gives it none, writes the decision as a
  line outside any turn, and stops the asking turn if it still runs. Every
  decision is broadcast as `approval_resolved`, so every open tab takes the
  card down at once (`design/bots/bots.md` §5).
- `design/bots/bots.md` §5 (2026-10-15) gave the bot one turn after a
  yes, once the approved call had run, so the chat was silent for the
  call's whole run and the model's first token after it. On 2026-11-02 the
  owner asked for the bot to answer first, as a person does: a yes now
  queues a short "on it" turn at once, the chat shows the call running
  under it, and the report is its own turn after, drawn "Done: …" (`design/bots/bots.md` §5).
- `design/bots/bots.md` §3 had a message written while a bot works
  wait over the composer for the turn after. On 2026-10-31, from Codex's
  `turn/steer`, Enter steers the running turn instead: the turn takes the
  message at its next tool call, and one it never reaches runs as its own
  turn; Alt+Enter still queues it for after
  (`design/sessions/terminal-and-chat.md`, "Steer in the bots chat").
- The bot stream was lossy by design: text published while the browser was
  away was gone, and the console matched what it streamed against stored
  text to avoid drawing it twice. On 2026-10-31 a running turn's unstored
  text is kept beside the channel and sent as a snapshot when the browser
  connects, and the console reconciles by block and sequence number, the
  stored message being the authority (`design/bots/bots.md` §2,
  `design/sessions/chat-protocol.md` slice 2).
- `design/bots/bots.md` §7 listed slash commands among what bots did not have yet. On
  2026-10-31 the owner asked how OpenClaw and Grok Bot support skills
  (`research/lessons-from-openclaw-and-grok-bot-skills.md`) and for slash
  commands; they were built as a bot's skills: one row each, listed by name
  and description in every prompt and read with `use_skill` when used,
  saved by the bot with `save_skill` or by hand in Settings → Skills, and
  run by the person as `/<name>` (`design/bots/bots.md` §4.1, Skills).
- `design/channels/channels.md` placed WhatsApp third among the channels, after
  email and contacts, and as a channel (people write to a bot). On
  2026-10-30 the owner asked for it first, the way OpenClaw does it, so that
  bots can see and talk with people: it was built as a connector in mail's
  shape on the channels note's runner transport, and the control plane now
  keeps the messages a linked number sees for 90 days
  (`design/channels/whatsapp.md`). The channel comes after, on the same device.
- Codex cloud sessions named their environment by guessing its label from
  the repository (`design/sessions/cloud-agents.md`, "Codex is built"). On
  2026-10-31 a session failed on an environment labelled otherwise, and
  the owner asked to improve environment management: the host now lists
  the ChatGPT account's environments and starts the task in the one linked
  to the repository, and New session has an Environment chip to pick
  another, kept with the session's launch (`design/sessions/cloud-agents.md`,
  "Which Codex environment"). To list them the host reads the Codex CLI's
  sign-in, which "Environments the CLI cannot reach", decided the same day,
  had ruled out; which holds is open, for the owner.
- `design/sessions/cloud-agents.md` started Codex cloud sessions with
  `codex cloud exec`, which reaches only the environments ChatGPT now calls
  Codex Cloud (Legacy). On 2026-11-12, for issue 835, the owner asked for no
  legacy: the runner now starts and follows a thread on Codex's current
  cloud service itself, with the host's ChatGPT sign-in, in Codex's default
  environment with the repository or an environment id pasted from ChatGPT
  Settings; the host no longer lists legacy environments
  (`design/sessions/cloud-agents.md`, "On Codex's current cloud"). It reads the
  CLI's token to do so, which "Environments the CLI cannot reach" had ruled
  out.
- `design/channels/mail.md` §3.5 kept `trash_mail` asking every time, Full
  access included, with no Allow and no "always" on its card. On
  2026-11-02 the owner, cleaning a mailbox a batch of 25 at a time, asked
  that it can run on its own once they grant it: it still asks under every
  preset until then, and Always allow on its card or Allow in Settings
  makes it standing. Sends (§3.4) still ask every time and cannot be
  allowed.
- `design/sessions/terminal-and-chat.md` opened a session on Terminal, with
  Chat a tab beside it (only a pull request's review session opened on
  Chat). On 2026-11-02 the owner made Chat the default view of every
  session, a member's and a guest's: the terminal shows until the
  transcript arrives and stays the view for an agent with none, and the
  Terminal tab is still there to type into the PTY. On 2026-11-04 the owner
  put Terminal back as the default: the chat waits for the host to resend
  the whole transcript every time a pane mounts, moving between sessions
  too, while the terminal draws at once from the grid the tab kept, so
  opening on Chat meant waiting on a session that was already on screen.
  Chat stays a press away. A pull request's review session opens on
  Terminal too, as `0.2-pull-requests.md` says its tab does.
- `design/sessions/terminal-and-chat.md` sent a session's whole transcript,
  from its first line, on every attach (`reset` and the history). On
  2026-11-04 a Claude Code session's attach sends its last 40 turns
  instead, with `before`, the offset they start at, and the console asks
  for the 40 before that (`chat.older`, `attachment.chat.older`) as the
  reader scrolls to the top: a long conversation was megabytes read,
  sent and parsed to draw its end.
- `research/lessons-from-herdr.md` said herdr's agents do not survive a restart and took its screen
  manifests as the model for agent state. herdr-core, its successor, keeps
  programs alive across its own restarts and takes status only from the
  program (OSC 7501), which Claude Code speaks once the terminal answers
  its probe; tmux does not. On 2026-11-02 the agent's own report became the
  first source of a session's state, above the screen manifests, through
  the runner's `runner pty` wrapper (`research/lessons-from-herdr.md` §4,
  `design/runner/runner.md` §9).
- `design/runner/runner.md` §5 and §12 said a reboot leaves every session
  stopped until someone presses Restart. On 2026-11-02 a session marked
  kept (`runner sessions keep`) is restarted on its own after a reboot,
  reopening its conversation; the rest still wait for Restart.
- `design/clients/mcp-cli-and-agent.md` placed delegation (`spawn_task`,
  `wait_task`, `send_message`) behind an MCP server in the 0.6 slice. On
  2026-11-02 the host-side half landed in the runner instead, ported from
  herdr-core: an agent in a session starts, tells and waits on child
  sessions with `runner sessions run|send|wait|report` (`runner --skill`).
  The control-plane half, a child the console lists, is still 0.6's.
- `design/sessions/chat-protocol.md` kept the agent's transcript file the
  one source of the session chat, and `0.7-terminal-and-chat.md` named a
  second file reader as how another agent joins. OpenCode keeps no such
  file: its conversations are in a database whose tables move between its
  versions. On 2026-11-02 OpenCode sessions got the chat by another source:
  the runner launches OpenCode serving its own API on a loopback port with
  a password of the session's, and follows the conversation through that
  API, writing each finished part as a line in the transcript shape the
  console already reads. Claude Code still reads its file.
- `design/bots/bots.md` §4.1 stopped a goal when any turn of it
  failed, since a failure would only fail again. A turn stopped at the
  4-minute limit for one turn is the exception, decided on 2026-11-02 after
  a mail-cleaning goal stopped at its first long turn: the goal is the way
  past that limit, so that turn is reviewed and the next continuation goes
  on, told to take a smaller step.
- `design/console/screens.md` listed Claude Code's models as the newest
  of each line, Haiku 4.5 among them. On 2026-11-02 the owner asked for
  the list Claude's own picker shows: Opus 5.5, Fable 5.1, Sonnet 5.5 and
  Haiku 5.5, then Haiku 4.5, Sonnet 5, Opus 5, Fable 5, Opus 4.8, 4.7, 4.6
  and Sonnet 4.6 behind "More models" — the catalog's `legacy` models.
- `design/console/inbox.md` built the Inbox only from what the system
  already knew, with no way for an agent to post into it. Since 2026-11-02
  an agent in a session can: `runner sessions notify "line"` keeps the line
  on its session, and the Inbox lists it until it is marked done
  (`design/sessions/agent-tools.md` §2). Since 2026-11-03 a bot can too, with
  its `notify` tool: its latest line is a `botNotice` item, and the Type
  facet's "Bot approvals" is "Bots" (§5).
- `design/sessions/agent-tools.md` §1 kept a shared file between the host and
  the browser attached to the session's chat; the control plane never
  heard of it. Since 2026-11-03 the runner also logs `file.shared` with
  the file's metadata (never its path or bytes), the session keeps the
  last 20, and a bot lists them and shows an image's preview, asked of
  the host over the link (`design/sessions/agent-tools.md` §7).
- `design/bots/bot-subscriptions.md` §1 had every wake re-read what it
  follows as the bot's owner and wake for what holds now, and §7 planned
  pull requests from the pull-requests module's webhooks. Built on
  2026-11-03, a bot following a pull request (`watch_pull_request`) is woken
  by the inbound-events hub's GitHub events instead, and its wake is the
  event's metadata alone, never a re-read: the pull request is GitHub's, not
  ours to re-read on every event. A close without a merge makes no event
  yet, so only a merge ends it (`design/bots/bot-subscriptions.md` §7.1, `design/sessions/agent-tools.md` §6).
- `design/bots/bot-subscriptions.md` §3 ended every subscription at
  20 wakes. On 2026-11-14 a bot following a project or a milestone
  (`watch_project`, `watch_milestone`) has no wake limit: it follows the
  plan for as long as it is worked on. What bounds it instead is that a
  change the bot made itself never wakes it (`design/bots/bot-subscriptions.md` §7.2).
- `design/bots/bots.md` treated text from tools as information, not
  instructions, and left every tool to the turn that reads it. On
  2026-11-03 a pull request watch made that text a stranger's comment
  starting an unattended turn, and Codex's review asked for narrower tools
  on such turns. The owner chose full autonomy instead: those turns keep
  every tool, and the prompt carries the defence, each GitHub author named
  as a collaborator or as outside the repository and a rule against putting
  private information where outside text points (`design/bots/bot-subscriptions.md` §7.1).
- `design/bots/bots.md` (2026-10-21) told a bot that a session was
  "the expected way, not a last resort" for code work, so bots opened one
  for questions the web could answer. On 2026-11-05 the owner asked for
  research first: a bot answers with its own tools, web search and
  `web_fetch` when it can, and starts a session only for work that needs a
  shell or a checkout, or when asked.
- `design/sessions/cloud-agents.md` had a cloud session followed up only at its
  vendor (`SESSIONS_039` for Cursor's). Since 2026-11-05 a Cursor session
  takes a follow-up through Oppenheimer as a new run of its agent, on the
  launcher's key and only once its last run ended; Claude Code's and
  Codex's still take none here ("Follow-ups to a cloud agent").
- `read_session` read a session's log and never its agent's conversation,
  which reached only a browser attached to the chat. Since 2026-11-05 a
  bot, `opp` and MCP read it a page at a time off the host, redacted, with
  a status that says how complete each page is; a cloud session's is
  unsupported, with its vendor's link (`design/sessions/agent-tools.md` §8).
- `design/sessions/agent-tools.md` §2's notice reached the Inbox only. Since
  2026-11-05 it also wakes every bot that follows the session, once per
  notice (§9).
- `design/bots/bots.md` §2 sent a turn the newest messages that fit
  its history budget, and the OpenAI engine named no conversation to the
  provider. On 2026-11-03, after `/usage` showed a bot on GPT and Grok at a
  1% cache hit rate, each request carries the bot's id as its
  `prompt_cache_key`, and the history loses its oldest messages a block of
  about 6,000 tokens at a time, so each turn's request starts as the last
  one's did.
- `design/bots/bots.md` §4.3 listed `create_project` and
  `update_project` as asking first. On 2026-11-03 (issue #647) they were
  built to run under Approve for me like the task writes, since a project is
  metadata and an edit can be put back; `archive_project`, which cannot be
  undone, asks under every preset, one call at a time. `move_session` was
  added, and the workspace stream gained `project.changed`.
- `design/foundations/api-modules-and-data-model.md` kept an archived project
  for ever with no way back ("there is no un-archive"). On 2026-11-03 the
  owner asked for restore: `POST /projects/{id}/restore` and the bot's
  `restore_project` bring the same row back with its slug, so a slug is
  still never reissued. The automations its archive paused stay paused.
- `design/console/inbox.md` §1 ordered the Inbox most blocked first:
  approvals and waiting sessions oldest wait first, then requested
  reviews, ready merges and failed runs. On 2026-11-03 the owner asked for
  the most recent first, so the list is newest first across every kind,
  Low items still last; the order is held by the consumer's
  `composeInbox` test, no longer by the fleet stress suite.
- `design/console/inbox.md` §1 listed pull requests for you (a review
  asked of you, yours ready to merge) in the Inbox. On 2026-11-10 the
  owner asked to stop: agents open pull requests under the owner's account,
  so each one waited there as theirs to merge. They are off by default
  and come back with Show pull requests in the Inbox's filter menu, kept
  on the device (the note's "Pull requests are opt-in").
- `design/clients/mcp-cli-and-agent.md` asked whether the CLI is a new app
  or `runner` grows user commands, and noted the starter's CLI and MCP apps
  were pruned. On 2026-11-02 both came back as their own apps, `apps/cli`
  (`opp`) and `apps/mcp`, clients of the API on scoped tokens: they reach
  automations, bots and tasks, which are not the runner's to forward. The
  runner keeps the same-host verbs.
- `design/sessions/cloud-agents.md` left bringing a Claude Code cloud session
  back as a command to copy, with no button that opens a worktree session.
  On 2026-11-03 the owner asked to pick the host from the session's pane:
  *Continue on a host* starts a worktree session there whose agent runs
  `claude --teleport <id>` (`teleport` on the create, runner capability
  `session.teleport`). Codex's `codex apply` stays a command.
- `design/channels/mail.md` §5's build log (2026-10-29) had an account start
  from the moment a routine *first* watched it, so a mark kept through a
  pause or a revoked grant replayed the gap's mail as new. On 2026-11-04 an
  account the poll does not read loses its mark and starts again from now;
  mail older than two days, spam, trash and chats never wake a routine, an
  any-mail trigger takes only the inbox, and rate-limited runs are one chat
  line a routine an hour.
- `design/runner/runner-install-and-update.md` §2 said a
  quarantine-stripped bare binary was all macOS needed, with no
  notarization. It ran, but each release was a new program to macOS (an
  ad-hoc signature in a new file per version), so every Mac asked for its
  permissions again after every update. On 2026-11-04 the runner became a
  Developer ID signed, notarized `OppenheimerRunner.app` at one fixed path
  on macOS, swapped in place by updates (`design/runner/runner-install-and-update.md` §2, §5).
- `design/console/screens.md` had the Sessions sidebar make projects (a
  plus in its head) and edit them (a settings glyph on each project's
  header). On 2026-11-05 the owner moved project management to Plan: a
  **Projects** view in Plan's sidebar (`/plan/projects`) lists the
  workspace's projects with New project and each one's settings, and the
  Sessions sidebar keeps only New session here on a project's header.
  New session's project chip still ends in New project….
- The 2026-11-05 line above left the Sessions sidebar no way to make a
  project. On 2026-11-07 the owner asked for one back, in the filter menu:
  the Project facet's list ends in **New project…**, opening the project
  dialog (`design/console/screens.md`). Editing projects stays in Plan.
- `design/plan/plan-product.md` drew Plan's board as Later, To do, In
  progress and Done. On 2026-11-05 the owner dropped **Later** and added
  **In review** between In progress and Done, for finished work waiting to
  be looked at. Tasks that were in Later moved to the end of To do
  (migration `ReplaceLaterWithReviewColumn`); attaching a session still
  moves only a task in To do to In progress.
- `design/bots/bots.md` §4.1 (2026-10-29) kept a bot's facts as
  `profile` by default, the newest 60 in every prompt, `log` facts only
  through `recall`, and refused a save past 200. Bots saved almost nothing
  after their first chat. On 2026-11-06, after a read of Grok Bot 0.79.2
  (`research/lessons-from-grok-bot.md` §10), the owner took its shape: a
  bot's save is `log` by default, the system prompt carries the newest
  profile facts by characters (4,000) and the turn context the newest log
  entries (2,000, dated), so a save leaves the prompt cache warm, the turn's
  rules tell it to save what it learns without asking, and a full memory
  of 500 drops its oldest log fact instead of refusing.
- `design/bots/bot-routines.md` §6 (2026-10-16) said a bot gets a
  heartbeat only when asked for one in chat, through `update_routine`. On
  2026-11-06 the owner asked for bots to be proactive by default, the way
  OpenClaw's are: a bot is now given a **Heartbeat** routine as soon as it
  has a job (its `INSTRUCTIONS.md` first written), hourly at a minute
  spread by its id, saved as its owner within the scopes of the credential
  that wrote the job, which the owner pauses or deletes like any routine.
  A beat with nothing to say calls `nothing_to_report`, offered only on
  turns nobody is waiting on. Bots that had a job before get none until
  asked (`design/bots/bot-routines.md` §6, "Decided").
- `design/bots/bot-routines.md` §6 (2026-10-18) designed the routines'
  spend guard as a nudge card, then a pause with a card to resume, and a
  per-bot "don't ask again". On 2026-11-07 the owner asked for it to work
  like an agent that stops watching a pull request: it stops on its own and
  comes back when the person does. Built that way: after 3 routine reports
  the owner has not seen, or 72 h away from the bot's chat, every routine
  of the bot pauses as `unattended` with one Inbox line, and the owner's
  next visit to the chat (or message, or decided card) resumes them. No
  cards; the thresholds are workspace automation settings, and a per-bot
  "Pause while you're away" switch turns it off (`design/bots/bot-routines.md` §6, "Changed
  2026-11-07").
- `design/bots/bots.md` §4.1 (2026-10-29) left what a bot knows about
  its owner spread across their bots: each `person` fact was edited on the
  bot that learned it, read only on the others, and the owner had no place
  of their own. On 2026-11-07 the owner asked for one page, the way
  Claude's memory works: Settings → Memory, at the account, holds an
  *About you* text the owner writes (table `person_memory`, migration
  `AddPersonMemory`), in every bot's system prompt and never written by a
  bot, and lists every `person` fact their bots learned, each still the row
  of the bot that keeps it and changed there.
- `design/sessions/cloud-agents.md` ("Follow-ups to a cloud agent") said a
  Claude Code cloud session's conversation is not ours to read, so the
  console only linked to claude.ai. On 2026-11-07 the owner asked for its
  chat in the console: two hooks in the session's repository send its
  transcript to the API and collect replies typed in the console ("The chat
  of a cloud session"; `research/spikes/cloud-chat-bridge/`).
- `design/bots/bots.md` §7 (2026-10-14) made a bot's avatar its
  initials on one of eight colours. On 2026-11-07 the owner asked for
  better avatars: each bot now has a drawn face, a hatted face in its
  colour cut out like a sticker, generated from its id. The same day the
  product's mark became a white fedora on an ink tile (favicons, the
  extension, `BrandMark`, the console rail's top as a link home, beside the
  name on sign-in and the public pages; the console's sidebar header is the
  name alone), replacing the starter's asterisk, the rail's "O" and the
  three-part hat favicon. A bot's owner can also pick its face in Profile
  (hat, eyes, mouth).
- `design/bots/bots.md` §1 had a bot report a failed session and stop
  ("do not start it again unless the person asked you to retry such
  failures"). On 2026-11-08 the owner asked for bots as proactive as
  OpenClaw's: a bot whose session failed on the default host because
  Claude Code there was not signed in reported it with three other hosts
  online. A failed step now sends the bot to the next reasonable route
  first (another online host, another source, another approach), and when
  a session it started on a host it chose fails in a way that looks like
  the host's, it offers to run its task on another online host and starts
  it on the person's yes. A host the person named
  is never overridden, a watched session or a task that fails on its own
  merits is still reported, not retried, and a person's "no" is never
  routed around.
- `design/bots/bots.md` §2 (2026-10-29) told a bot to report only what
  a tool confirmed, which left the checking to the bot's judgement. On
  2026-11-07 a bot started a cloud session that could not start and said
  so only when asked, and the owner asked bots to always check. The prompt
  now has one section, "Check before you report": an action's tool answer
  is read, then read back where a tool can, a failure is said first and
  unasked, and a coding agent's report is a claim checked against its
  evidence.
- `design/bots/bots.md` §4.2 (2026-10-30) left `start_cloud_session`
  unwatched, since a cloud session is followed at its vendor, and §2's
  closed list quoted each tool's first sentence. On 2026-11-07, after a
  review of every prompt, a cloud or review session is watched like any
  other (a failed cloud start had gone unreported), and the list names the
  tools by area: quoting them made it 62% of the system prompt.
- `design/bots/bots.md` §2 (2026-10-15) bounded a turn by 20 round trips
  and 4 minutes but failed it only past the time; one that used its steps
  ended completed, with nothing said. On 2026-11-08 it fails with
  `step_limit`, saying so, and goals and loops go on past it as past the
  time limit (`TURN_LIMIT_FAILURES`).
- `design/bots/bots.md` §2 (2026-10-15) folded a bot's chat into its
  summary past 1.5 times the history budget, while the history dropped old
  messages at the budget, so up to about 12,000 tokens were in neither. On
  2026-11-08 the fold starts below the budget, with room for the longest
  summary and the notes on earlier images (`BOT_SUMMARY_TRIGGER_TOKENS`).
- `design/plan/plan-calendar.md` (2026-10-13) drew the calendar as a
  month only and asked whether a week view came before Google
  write-back. On 2026-11-08, after that day's `Tasks` frame, it opens on
  Day, with Week and Month beside it, a task due at a time standing on
  the hours at that time, and Plan gains To do, one day's tasks (§6).
- `design/bots/bots.md` §2 (2026-10-15) left a turn's tool calls out of
  the history, as the bot's own working, so a later turn knew what its
  tools did only from what it had said. On 2026-11-08 they come back as a
  short record from Oppenheimer, fenced as data and bounded per call and
  per turn (`activityText`), and the summary and the goal reviewer read the
  same record.
- `design/bots/bots.md` §2 (2026-10-29) told a bot how full its context
  was only against a known window, so a bot on the OpenAI engines, which
  report none, was never told. On 2026-11-08 it is told its tokens, and
  asked for narrow reads from `BOT_CONTEXT_TIGHT_TOKENS`; the note no
  longer says every engine compacts on its own.
- `design/bots/bots.md` (2026-10-15) gave bots no shell at all: code
  work and scripts went to a coding agent in a session. On 2026-11-07 the
  owner asked for bots that run scripts themselves, without a sandbox per
  bot: `run_command` runs one program on a paired host, through its runner,
  only as that host's own `runner exec` policy allows, which is off until
  the person on the host turns it on.
- The Simulator (2026-10-26) offered a session a device only when the host
  named them in `RUNNER_DEVICES` and pointed the runner at Argent's
  binary and tool-server, so a host installed the ordinary way offered
  none and every session's Simulator tab said "No device". On 2026-11-08
  an unset `RUNNER_DEVICES` offers the simulators and emulators running
  when a session asks (simctl's booted ones, adb's emulators), and the
  runner finds Argent's `simulator-server` beside the `argent` on its
  PATH and the tool-server Argent has running in `~/.argent`. Naming
  devices still works; `off` offers none.
- `design/bots/bots.md` §2 said a bot "delegates a complete task and
  never runs a terminal". On 2026-11-08 the owner asked for bots that drive
  bash and ssh themselves: `open_terminal`, `type_in_terminal` and
  `read_terminal` type into a blank-terminal session and read its screen,
  only on a host whose `runner exec` mode is `full`. A coding agent is still
  given a task, never typed at.
- `design/bots/bots.md` §2 said the engines' computer tools are off and
  `research/lessons-from-grok-bot.md` left computer use out. On 2026-11-09
  the owner asked that a bot can use a computer on a host remotely:
  `use_computer` looks at a host's screen and uses its mouse and keyboard
  through the runner, on a Mac's own desktop or a Linux X display (a virtual
  one where there is none), only after `runner computer on` on that host.
  Nothing runs on the control plane, which is what §2 was protecting.
- `design/bots/bots.md` gave a bot the web through fetching a public
  page only. On 2026-11-11 the owner asked for browser use beside computer
  use: `use_browser` drives a browser of the bot's own on a host through the
  runner, reading a page as elements with refs and acting on a ref, only
  after `runner browser on` on that host. Fetching stays for a public page a
  bot only reads.
- `design/bots/bots.md` §4.1 (2026-10-29) let a bot file a fact as
  "about the person (their name, their role, their preferences)", read by
  all their bots. Bots filed their job there: Facturas read another bot's
  XRP Mobile project and pull request notification setting. On 2026-11-08
  the owner asked for two memories made plain, a general one and one per
  bot: `remember` takes `memory: 'yours' | 'general'`, the prompt names
  *Your memory* and *General memory*, and general takes only what a bot
  with a completely different job would need (`scripts/evals/bot-memory`).
- `design/runner/runner.md` §5 said a base that is not a branch on the
  remote fails the create. On 2026-11-08 a project on an empty GitHub
  repository could not start its first session for that reason, so an
  empty repository (no ref at all) is the exception: the create pushes an
  empty `Initial commit` to the base and cuts the session from it. A
  prepare leaves it empty; a repository with other branches still fails.
- `design/bots/bots.md` §2 bounded a bot's turn at 20 model round
  trips and 4 minutes, and §4.1 a goal at 20 continuations with a reviewer
  after each turn. On 2026-11-09 the owner asked for tasks that run for
  hours: Codex, Grok Bot and OpenClaw cap neither
  (`research/lessons-from-long-running-agents.md`). A turn now runs until
  the model answers, compacting mid-turn on every engine, stopped only by
  a silent model or the loop guard; a goal has no limit, the bot says when
  it is done and the reviewer checks that claim, and a goal that goes
  wrong pauses for the owner to resume instead of ending.
- `design/bots/bots.md` §4.1 paused a goal on a provider's usage limit
  for the owner to resume. On 2026-11-09, where the provider says when the
  limit ends, the goal waits for that time and goes on by itself; it pauses
  only when no time is known.
- `design/foundations/api-implementation-plan.md` (GitHub slice) had the
  webhook read `request.rawBody`, the copy Better Auth's app-wide JSON
  parser kept, so it needed no bootstrap change. That parser's 100 kB
  default refused ordinary `push` and `pull_request` deliveries with a 500
  (Sentry OPPENHEIMER-API-2, 2026-11-09). The webhook now reads its own body
  raw, up to GitHub's documented 25 MB cap, ahead of the app-wide parsers;
  a larger body is a 413, and the `rawBody` copy is gone.
- `design/plan/plan-product.md` §1 (2026-11-05) listed Plan's Projects
  as a row per project with its settings. On 2026-11-08, following that
  day's `Tasks` artboards, each project is a card (its repositories, and
  Needs input, Running or Idle from its sessions) that opens the project's
  page, `/plan/projects/<id>`: its milestones, the tasks waiting on a
  person, the ones in progress, and Settings. The artboard's Chat and Stats
  tabs on that page are not built: there is no per-project agent or
  per-project statistics yet.
- The 2026-11-08 line above left the project page's Stats unbuilt, saying
  there were no per-project statistics; `GET /plan/stats?projectId=`
  (`design/plan/plan-milestones-stats-accounts.md` §4) had them. On
  2026-11-09 the owner asked for it: the page switches between Overview and
  Stats, which reads that endpoint over a period. Pull requests stay off it
  until the endpoint carries them (`design/plan/plan-milestones-stats-accounts.md`, decided 4).
- `design/bots/bots.md` (2026-11-08) made `recap` something the person
  asks for: `/recap` in a bot's chat, "recall" in a session. On 2026-11-09
  the owner asked for it at the end of every finished task as well: a bot's
  wake for a finished session ends with a recap of it, a session's agent
  ends each task it finishes with one, and so do agents working in this
  repository (the `recap` skill).
- `design/plan/plan-tasks-and-goals.md` gave a task no priority. On
  2026-11-17 the owner asked for a few levels after looking at Linear and
  ClickUp: a task has an optional priority, Urgent, High, Medium or Low,
  drawn with Linear's icons (the "!" square for Urgent), that never
  reorders a column (§9, "Priority").
- `design/console/inbox.md` gathered what needs the person from the
  sessions, bots, pull requests, runs and reports, and a task an agent made
  went straight onto the board with nothing to say so. On 2026-11-12 the
  owner asked that such a task wait in the Inbox for him to triage: a task
  now says who made it (`origin`) and when its person took it up
  (`triagedAt`), and waits in the Inbox until he gives it a TODO day, starts
  or links a session on it, or dismisses it (`design/console/inbox.md`, "Tasks an agent made").
- `design/plan/plan-calendar.md` §6 (2026-11-08) had To do list a
  day's tasks by their due date. On 2026-11-09 the owner asked for it to be
  what they mean to work on: a task has a focus date apart from its due
  date, To do lists what is put on the day and what is due on it, keeps
  unfinished work from earlier days until it is done, and opens a task's
  dialog on To do rather than on the board (§6, "Changed on 2026-11-09").
- `design/plan/plan-calendar.md` §6 (2026-11-09) listed every task on
  To do's day the same way, whatever its agents were doing, and "To do"
  named the view, the board's first column and the dialog's day field. On
  2026-11-12 the owner asked for To do to know about agents: a task an
  agent is working on moves to a "With agents" section under the list and
  out of the counts, the others with sessions are marked (waiting on you,
  failed, ready to review, agent stopped), a row's Move puts it on another
  TODO day, and the names became TODO, Not started and TODO day, labels
  only (§6, "Changed on 2026-11-12").
- `design/channels/channels.md` §5 and §6, `design/channels/customers-and-routes.md`
  §5 and `design/channels/telegram.md` §2 and §3 changed on 2026-11-09, when the
  owner's `/start` went unanswered: the decision is
  `design/channels/answering-on-telegram-and-whatsapp.md`.
- `design/channels/answering-on-telegram-and-whatsapp.md` §1 (2026-11-09) had the
  spare WhatsApp number send your personal number a code you send back from
  it. On 2026-11-09, building slice 3, the code became one you enter in
  Settings → WhatsApp instead: sent back from the named number, a stranger
  who owns a mistyped number would receive it and become your line. A bot's
  reply to your own message there counts only against the host's send
  budget, not the 100 bot sends a day (`design/channels/whatsapp.md` §4).
- `design/console/inbox.md` said, from 2026-10-25, that the Inbox stores
  nothing but your marks and that no agent posts into it. On 2026-11-09 the
  owner asked for the unattended agents to send him problems with images
  and to answer them only in the Inbox: a report is now stored
  (`inbox_report`, up to four pictures), sent by anything holding a token
  with `inbox-reports:write`, answered from its card, and read back by the
  agent that sent it (`design/console/inbox.md`, "Reports").
- `design/console/screens.md` listed Fable 5.1 among Claude Code's four
  current models. On 2026-11-09 the owner asked for Fable 5.2 in new
  sessions and in bots: it takes Fable 5.1's place, and Fable 5.1 heads
  "More models", since Claude still serves it. OpenCode's `anthropic/` row
  moves to Fable 5.2 as well, with Fable 5.1 behind its "More models".
- `design/console/inbox.md`, "As built", had Plan open on its Inbox. On
  2026-11-09 the owner asked that Plan open on the view dragged to the top
  of its sidebar: the rail and the console's landing go through
  `/plan/open`, which redirects there (the Inbox until another is dragged
  above it).
- `design/bots/bots.md` §4.1 (2026-10-31) had a bot save a skill only
  when the person asked. On 2026-11-09, from Hermes Agent's learning loop,
  a bot may save one on its own after hard work likely to come again (at
  most one a turn, never anything private), a turn someone waits on that
  has run 8 tool calls with no skill used or saved reminds it once, and
  `patch_skill` fixes one passage of a skill. Either tool changes a skill
  the person wrote last only when they asked, and neither touches the
  skills Oppenheimer gives every bot.
- `design/bots/bots.md` §4.1 (2026-11-09) reminded a bot after 8 tool
  calls, in a line it was never told about, and `use_skill` did not say
  who wrote a skill. On 2026-11-10 the skills paragraph announces the
  reminder (Oppenheimer's own `<oppenheimer_reminder>` line at the end of
  a tool's result, which a tool's output cannot forge), the reminder comes
  after 6 calls, work the person says comes back is reason enough to save,
  and `use_skill` says whether the bot or the person wrote the skill last.
- `design/bots/bots.md` §4.2 (2026-10-27) had a bot find a session only
  by listing them, newest first, and read one it already had the id of. On
  2026-11-09, from Hermes Agent's session search, a bot searches every
  session of the workspace, on any host and closed ones included, for words
  in its name and log (`search_sessions`); the agents' transcripts on the
  hosts are not searched. The `recap` skill searches its topic the same way.
- `design/bots/bots.md` drew a turn's compaction as a quiet line among
  its calls, the trace at the reply's 15px in muted ink, and the live
  line's orb as `composing`. On 2026-11-09 the owner asked to stop seeing
  compactions, for quieter tool calls and for the solving and searching
  orbs: the chat draws no compaction (the export keeps it), the trace is
  13px in subtle ink, and the orb solves, or searches while the running
  call only looks around (`design/bots/bots.md` §2 and §3).
- `design/plan/plan-product.md` §4 had Start session always start from
  one of the project's repositories. On 2026-11-09 the owner asked to start
  one with only a host: the Repository chip offers No repository, which on
  a host opens the session in the host's home folder.
- `design/bots/bot-subscriptions.md` gave a task a bot hands off one
  stall check and "no progress update", and its prompt told a bot asked to
  monitor that "checking now adds nothing". On 2026-11-10 the owner had to
  tell Facturas "you should be babysitting this" while two of its agents sat
  idle: a bot now looks at a task still running every ten minutes after the
  first check, up to an hour, staying quiet when it is on track, and checks
  at once when asked (§4.2).
- `design/bots/bots.md` §4.2 had `start_session` launch every session
  at `auto` on the host's default model, decided 2026-10-18. On 2026-11-10
  a bot told the owner it could not start a session on Opus 5.5: the tool
  now takes everything the composer offers (model by id or name, effort,
  permission, base branch), refuses what the agent does not take with what
  it does, and names each choice on the card. `auto` stays the default,
  and a session at full access is approved on its own card, every time.
  An eval holds it (`scripts/evals/bot-session-launch/`).
- `design/pull-requests/pull-requests.md` ("The screens as built", 2026-10-13)
  left a pull request with no generated summary until the chat came, and
  the queue as a table. On 2026-11-09 the owner asked for the queue one pull
  request at a time, summarized and with its pictures, the next one coming
  up after each action: the **review deck** (`/pulls/review`, the same note,
  "The review deck"), whose card leads with a brief of the head commit that
  the deployment's model writes, or the description gives when there is no
  model. The queue, the description page and Analytics are unchanged.
- `research/lessons-from-grok-bot.md` §3 left "VNC inside the box for
  computer use" for later. On 2026-11-09 the owner asked to watch and click
  the machine an agent runs on: a host's own desktop streams to the console
  through the screen-sharing server on its loopback, shared by its owner
  with `runner desktop on` (`research/device-streaming.md`, "A host's
  desktop"; the note's §11 is the read that led to it).
- `design/bots/bot-routines.md` §6 built the routines' spend guard on
  2026-11-07: a bot's routines paused after 3 reports its owner had not seen,
  or 72 h away from its chat. On 2026-11-10 the owner asked for it to go: a
  half-hourly Sentry triage that reports "no new events" paused within hours,
  and OpenClaw, whose heartbeat the note follows, has no such guard. Removed
  whole (the pause, the per-bot switch, the workspace thresholds, the Inbox
  line, `POST /bots/:id/seen`); the migration resumes what it had paused.
  Routines run until paused; the run budget, the overlap guard and quiet
  turns bound the cost (`design/bots/bot-routines.md` §6, "Removed 2026-11-10").
- `design/bots/bot-routines.md` §6 gave every bot with a job an hourly
  Heartbeat (2026-11-06). On 2026-11-15 the owner found it eating their
  tokens: a model turn an hour, all day, on each bot. No bot is given one by
  default any more; the migration moved every default Heartbeat to twice a
  day (09:00 and 18:00 in the zone its owner last wrote from, UTC when
  unknown) and paused it, so the owner turns it on and changes its times
  like any routine. A scheduled beat with nothing new in the bot's chat
  since the last one (another routine's or a loop's turn does not count) is
  skipped as `idle` without a model turn; Run now always runs (`design/bots/bot-routines.md` §6,
  "Changed 2026-11-15").
- `design/console/screens.md` left plain **Ctrl+V** to the program off
  the Mac, pasting only on Ctrl+Shift+V. On 2026-11-10 the owner pasted a
  screenshot into the terminal with Ctrl+V and Claude Code, reading the
  host's clipboard, said "No image found in clipboard". Ctrl+V now pastes
  off the Mac too, as ⌘V does on it, so a pasted image is uploaded to the
  host; a program that wanted a literal ^V no longer gets one from it.
- `design/bots/bot-subscriptions.md` §4.2 looked in only on a task a bot
  handed off itself (`start_session`, `send_to_session`). On 2026-11-10,
  the same evening, Facturas told the owner it would check a session once
  it pushed and was never woken: it had only read that session. A task a
  bot unblocks with `answer_session` is now followed like one it handed
  off, a running task it `watch_session`s gets the same looks,
  `check_in_minutes` adds one at a time the bot names, and its prompt says
  never to promise to come back to something nothing will wake it for.
- `design/bots/bot-routines.md` §4 drew every routine activity as a line in its bot's chat: a
  "Routine · *name*" divider over each run, and one for each save, change,
  pause and delete. On 2026-11-10 the owner read a bot's chat as an
  automation's log ("I'll refresh the queue, review evidence…" under a
  "Routine · Automerge clean PRs" line). The chat now shows a routine only
  when it needs the owner (a run that did not happen, a pause they did not
  make), a run's turn reads as the bot writing to you, and the prompt has
  the bot write as someone on the team in every turn.
- `design/sessions/terminal-and-chat.md` ("Data reads as data") opened a
  reply's JSON block as a tree, Tree / Raw on its band. On 2026-11-11 the
  owner asked for the text first: the block opens on Raw, Raw / Tree on its
  band, the tree one click away. A tool result's JSON still reads as a tree.
- `design/console/screens.md` held the sidebar's sessions and projects
  still while a filter or the search hid some of them, since a drop would
  lose the hidden ones' places. On 2026-11-11 the owner tried to reorder
  sessions with a repository filter on and could not. They drag now,
  filtered or not: the drop is merged into the whole list's order, so a
  hidden row keeps its place among the ones it was drawn with.
- `design/console/screens.md`'s sidebar filter menu held its picks for
  the visit only: a reload came back unfiltered. On 2026-11-11 the owner
  asked for them to stick, as Plan's do (`design/plan/plan-product.md`, "Filters
  stick"): the facets and the sort are kept on the device, not the
  account, since a filter is the reader's view; a remembered pick the menu
  no longer offers reads as all and is forgotten.
- `design/automations/automations.md`'s editor prefilled a new automation
  with a project (the one it was opened for, else the first) and all of
  that project's repositories, and picking a project picked all of its
  repositories. On 2026-11-11 the owner asked for no default repositories
  and no default project: a new automation starts with neither unless it
  was opened for a project, and picking a project picks no repository.
- `design/bots/bot-routines.md` (§7) listed bot routines on
  `/automations` in a second table under the automations. On 2026-11-11
  the owner asked for them in tabs: the overview reads Automations · Bot
  routines · Runs, the routines at `/automations/routines`.
- `design/bots/bot-routines.md` drew every routine run in its bot's
  chat, and the chat showed its tool calls until the reader hid them. On
  2026-11-11 the owner, scrolling a column of half-hourly "Routine ·
  Triage Sentry errors" lines that found nothing, asked for less: the
  chat now hides tool calls by default, and while they are hidden a
  routine run that only ran tools is left out. The wrench shows both.
- `design/sessions/cloud-agents.md` ("The chat of a cloud session") had a reply
  typed in a Claude Code cloud session's chat reach the agent only while
  its Stop hook waited (up to two minutes); one typed later sat until a
  next turn that never came. On 2026-11-11, as decision 2 there said, a
  reply no hook takes within 15 seconds is sent from an online host signed
  in to the session's claude.ai account (`claude -p … --cloud <id>`, the
  link's `cloud.reply`), which wakes the session; the console shows it as
  sent until the transcript has it.
- Pages under a parent (a project, an automation, Add a host, a host's
  Desktop) opened with a breadcrumb line above the title, some under a
  Back pill as well. On 2026-11-12 the owner asked for no breadcrumbs
  in the console: each such page keeps only the Back pill
  (`EditorPageBack`), and `PageHeaderCrumbs` left the design system.
- `design/bots/bots.md` §1 (2026-11-08) sent a bot to the next route
  after a failed step, and had it "keep going until the request is done or
  you are blocked, then stop". On 2026-11-12 the owner saw a bot's
  half-hourly routine answer "the designated session is still closed" for
  hours and asked for bots that stop at a blocker and think of a solution
  that makes sense. A blocker is now the bot's to solve before it reports
  it (a closed session is replaced by a new one with the same task), within
  its permissions and instructions and never around a "no", and a routine's or a
  loop's run is told so in the note that opens it. It is also told never
  to report the same blocker twice, which a bot with no way round still
  does (open).
- `design/sessions/cloud-agents.md` ("The console") had send in Cursor's cloud
  open Cursor's agent page in a new tab, opened in the press so no popup
  blocker refused it, and go to the session. On 2026-11-12 (issue #836) the
  tab sat blank while Cursor answered and closed empty when Cursor refused
  the launch. Send now opens no tab and goes to the session, as every start
  does; the session's page ("Open in Cursor") and its row link to Cursor.
- `design/bots/bot-routines.md` §6 ("Quiet turns", 2026-11-06) had a
  quiet turn write no message because the bot was told to write nothing
  after `nothing_to_report`. On 2026-11-12 a bot with a blocker it could
  not get round, and its person already told, called it and wrote the
  blocker again on every run. On 2026-11-13 the silence is kept in code: a
  turn that ends on `nothing_to_report` keeps no message, whatever the
  model wrote before or after the call.
- `design/bots/bots.md` §4.1 had the built-in skills (`oppenheimer`,
  `recap`) live in product code only, so Settings → Skills listed none of
  them and a bot saying it "used the `oppenheimer` skill" pointed at
  nothing the person could find. On 2026-11-12 the owner asked to see them:
  the page lists them under the bot's own in a read-only "Built in" group,
  with a view of the instructions and no edit or delete.
- `design/console/inbox.md` ("As built") headed the clear reading pane
  "Nothing needs you", left-aligned. On 2026-11-14 the owner asked for it
  to be warmer: it reads "You're all caught up", centred under a small
  drawing of an empty tray; the line under it is unchanged.
- The codebase was to keep every app the starter ships, but on 2026-09-23
  the apps the MVP did not use were pruned, the mobile app among them. On
  2026-11-14 the owner started 0.5 as a native Expo app: `apps/mobile` came
  back with its kit and design system, as a shell first (sign-in and the
  five tabs, Account working), push as its own slice, and no sign-up on the
  phone (`design/clients/mobile.md`).
- The 0.5 shell first drew the export's frosted tab bar and cards solid,
  since React Native has no blur of its own. On 2026-11-15 the owner asked
  for native Liquid Glass everywhere it exists: the tab bar, selects and
  back buttons are the platform's own controls, and floating surfaces are
  `UIGlassEffect`, so iOS 26 draws Apple's Liquid Glass
  (`design/clients/mobile.md`).
- 0.5's shell left sign-up to the web, where the workspace is named. On
  2026-11-15 the owner asked for the whole auth flow on the phone: Create
  account, the workspace step, Ready, forgot and reset password, all in the
  native frame; GitHub and the first host stay the computer's
  (`design/clients/mobile.md`).
- `design/channels/answering-on-telegram-and-whatsapp.md` §2 (2026-11-09) had
  the owner link opened from the console with its code never shown. On
  2026-11-15 the owner, with no Telegram app, opened it on Telegram Web,
  which drops the `start` code, and had to type `/start <code>` by hand.
  Under a link just made the console now also shows that message, with
  Copy, and opens the bot's chat on Telegram Web.
- `design/bots/bots.md` §1 (2026-11-11) had a new bot end a reply that
  did the work its first message asked for with its name and job
  questions. On 2026-11-13 the owner found asking its name after the task
  odd and the welcome too long: work is now just done, and the welcome is
  a few warm sentences with no list. A name or job that matches one of the
  owner's projects now says which project the bot is for.
- `design/bots/bots.md` §1 (2026-11-08) had a bot whose own session
  failed on a host it chose, for a reason that looked like the host's,
  offer the task on another host and start it only on a yes, since only
  the session's untrusted words said the host was at fault. On 2026-11-15
  the owner saw a bot stop at "then I can retry" with other hosts online
  and asked for bots that look for another way: the bot now starts its own
  task on another capable host, its approval level deciding whether that
  asks first, and never moves off a host the person named.
- `design/bots/bots.md` §1 had a new bot never pick or suggest a name of
  its own (2026-11-10, from OpenClaw's `BOOTSTRAP.md`), say nothing about
  its name after a first task (2026-11-13), and take the next of Juno,
  Milo, Wren… in order, so every workspace's first bot was Juno. On
  2026-11-15 the owner asked for the opposite on each: the welcome suggests
  a name, a first task ends with one line that the bot has no name yet, and
  new bots take a physicist's name at random. The failure rules of
  2026-11-08 to 2026-11-15, a page of cases, became four lines in Claude
  Code's manner, keeping the limits the incidents earned.
- `archive/vision-and-plan.md` §5 rejected Electron because state must live server-side, and
  the desktop spike (`research/desktop-app-spike.md`, 2026-10-18) kept that
  rule with Electron on the hosted console. On 2026-11-16 the owner chose
  Electron over Tauri for the desktop, on the measurements in
  `research/desktop-electron-vs-tauri.md`: on Linux Tauri saves download
  size (2.3 vs 86 MiB) and costs memory, start-up time, Rust and a WebView
  per platform. Tauri is reconsidered only if download size starts to
  matter, and then measured on a Mac first. State still lives server-side.

- `design/sessions/session-previews.md` put the Browser and Simulator in a
  preview pane of their own, as pill tabs. On 2026-11-16 the owner asked
  for side chats, terminals and bots beside a session: that pane became the
  side pane (`design/console/side-pane.md`), where the previews are three
  of the things the launcher opens, each a tab beside a shell, another
  session or a bot's chat.
- `design/console/side-pane.md` §1 listed Terminal, Agent, Session, Bot
  and the previews as the launcher's rows, and the session's bar held its
  name, its state and the worded Terminal / Chat switch. On 2026-11-24 the
  owner asked for tabs and a calmer layout (`design/console/session-tabs.md`):
  open sessions and bots are tabs in a one-line bar, the state moves to the
  tab's dot and tooltip, and the launcher is large rows with Agent, Session
  and Bot folded under Side chats.
- `design/console/session-tabs.md` §1 left New session without the tab
  strip. The same day, once it shipped, the owner asked for the tabs to stay
  there too: New session's bar is the strip with a lit New session tab that
  is not kept. The bar is 45px with its controls on the medium rung, on the
  page's own ground rather than the grey band §3's contrast pass first gave
  it.
- `design/console/session-tabs.md` §1 then put the 45px tab bar on the
  page's own ground (the terminal's grey on a session, the canvas's black
  on New session). Later on 2026-11-24 the owner asked for the grey
  everywhere ("I liked that the tabs have the gray color", "never full
  black"): the bar stands on the terminal's ground on New session too, so it
  does not change when a session is created. Only the
  tabs stay on the medium rung; the bar's other controls go back to the
  small one.
- `design/bots/bots.md` §3 greeted an empty bot chat at 34px, asking for
  a job over four tiles (next-step pills once it had instructions), over the
  stacked composer. On 2026-11-16 the owner found it loud in the side pane
  and then on the page: the chat greets with the bot's face, its name and
  one line, over the composer's one-row layout, in both places.
- `design/plan/plan-calendar.md` §1 drew the calendar nearly
  achromatic: busy events in ink on the control wash, free ones and
  automation runs muted, only a Google account's ring in its colour. On
  2026-11-17 the owner asked for colour, like Google Calendar's: each item
  is a wash of its colour with a bar down its edge (personal events blue,
  tasks violet, each Google account its own; automation runs stay grey),
  and the first Google accounts moved off blue and violet to keep the
  legend unambiguous.
- `design/plan/plan-calendar.md` counted every item of the view in the
  header whatever layers were on. On 2026-11-17 the owner asked for filters
  (kind, project, status, who added a task, §7) and the counts now follow
  what the calendar shows: a hidden layer counts nothing.
- `design/bots/bots.md` §8 put a bot's prompt files in two folders,
  `system/` and `turn/`, with the wakes in `turn/`. On 2026-11-18 the owner
  asked to expand that with sibling folders: what opens a turn an event
  started is `wake/` now, and `turn/` keeps what a turn carries besides
  its opening (`research/prompt-file-formats.md` §4.1).
  started is `wake/` now, and `turn/` keeps what goes with a turn the
  person started (`research/prompt-file-formats.md` §4.1).

- On 2026-11-17, a runner-started Codex cloud session was confirmed complete
  while its console link opened only the Codex home page. The console now
  preserves the thread id at `https://chatgpt.com/local/<id>`
  (`design/sessions/cloud-agents.md`, "On Codex's current cloud").
- `design/console/screens.md` had GPT-6.1 Sol as Codex's default. On
  2026-11-17 OpenAI released GPT-6.2 Sol and GPT-6.2 Astra, and the owner
  asked for both in new sessions and in bots: they lead Codex's list,
  GPT-6.2 Sol is the default, and OpenCode's `openai/` row gains both. The
  OpenAI and ChatGPT bots read Codex's list, so they follow.
- `design/plan/plan-calendar.md` let a task leave TODO only by moving
  its TODO day, which a due date today or overdue overrides. On 2026-11-18
  the owner asked to remove a task from TODO, and chose that removing one
  keeps it off every day, its due date included, until it gets a TODO day
  again or its due date changes (`task."offTodo"`).
- `design/bots/bots.md` §2 had a summary job delay itself until the
  reset on a refusal for "rate or quota", but a spent credit or a refused
  key carries no reset, so it went to the queue's eight retries and each
  job's last one was reported as an error (Sentry OPPENHEIMER-API-7,
  14–17 Nov). On 2026-11-17 a job the provider refused for the account
  (`usage_limit`, `credential`) ends without a retry or a report; the next
  turn past the threshold folds again once the account is sorted.
- `design/channels/whatsapp.md` §3 kept a message's media on the phone, the bot
  told only its kind ("[audio]"). On 2026-11-18 the owner asked for bots
  that hear voice notes: the runner keeps each voice note's media key and
  path for 48 hours and hands the audio over when asked
  (`whatsapp.media.get`), and the API hears it through voice's providers
  when the turn the owner's voice note queued starts, keeping the transcript
  on the row, never the audio. Images and the bot's own voice replies come next.
- `design/channels/answering-on-telegram-and-whatsapp.md` §2 (2026-11-09) had a
  group, and any allowed contact, added only in the console, from a list per
  number. On 2026-11-18 the owner asked for a bot to do it too, in the
  conversation with the person who confirmed the number, and to see and
  manage the list in Settings: a bot allows a chat, and picks the bot that
  answers there, with `allow_whatsapp_chat`, offered only in the owner's
  console chat and their own chat with the number; Settings → WhatsApp lists
  the allowed chats with who allowed each, their bot and Remove. Which bots
  answer on a number is its default plus a bot per allowed chat, not a list
  of bots per number (`design/channels/whatsapp.md`, open question 1).
- `design/runner/runner-install-and-update.md` §5 (2026-11-04) had a Mac
  that a runner from before the bundle updated run the bare binary out of
  the new archive, then reinstall itself as the bundle. That bare binary is
  the bundle's executable, sealed to the bundle by its signature, and macOS
  kills it outside the bundle, so no Mac on 0.1.12 or older updated to 0.1.13
  or later (seen on 2026-11-19, with 22 failed stages left in `.staging`).
  With one Mac on the runner, already moved by hand, the owner chose on
  2026-11-20 not to build a way across: §5 now says such a Mac is moved by
  hand. A failed stage is now deleted, and a boot sweeps old ones.
- `design/foundations/control-plane.md` named a session from its first prompt
  only, once. On 2026-11-19 the owner asked for names that follow the
  conversation: after the agent answers the person's second prompt, a
  derived name is written once more from their prompts so far
  (`source: conversation`); a name a person typed is never replaced.
- `design/channels/answering-on-telegram-and-whatsapp.md` §4 (2026-11-09) sent a
  channel turn's answer once, at its end, and had a message sent meanwhile
  wait for the next turn: asked to check something, the bot went quiet for
  minutes, then answered. On 2026-11-20 the owner asked for a bot that
  answers first, works, and comes back with the result, answering what they
  ask in between: on the owner's own chat, what the bot writes before a tool
  call goes out as the call begins ("On it, checking your sessions"), a
  message sent meanwhile steers the running turn as a console message can,
  and the end sends only what came after the last call. Telegram's typing
  action and the fifteen-second line are not built.
- `design/bots/bots.md` §3 first kept a bot's "done" dot on the device (2026-11-20):
  what you had seen was the bot's last message time while its chat was open,
  per browser, beside the green dot on a working bot's face. The owner asked
  for the bots to read exactly as the sessions do, so the same day the read
  moved to the API (`bot."acknowledgedAt"`, set by opening the chat, on every
  device, only the bot's replies counting), the amber dot took in questions
  and failed turns, the green face dot went, and Mark as unread came in as a
  device mark like a session's.
- `design/channels/answering-on-telegram-and-whatsapp.md` §3 (2026-11-09) gave a
  contact's turn the customer turn's narrow tools: answer, the bot's
  documents, memory for the conversation, `hand_off`. On 2026-11-20 the
  owner asked for WhatsApp groups and other people to be answered next; the
  first version gives a contact's turn no tools at all, and counts its limit
  of 20 turns an hour per chat rather than per person. The narrow tools
  come after.
- `design/channels/answering-on-telegram-and-whatsapp.md` §2 (2026-11-18) had a
  chat allowed only by asking a bot in the owner's own chat, Settings
  listing the allowed ones, at most 50 per number. On 2026-11-20 the owner,
  with 25 groups and 200 contacts in mind, asked for settings that scale
  and for a bot to show its gateways: Settings lists every chat a number
  has seen, with search, filters and changes to many at once, and choosing
  a bot there allows the chat; a bot's settings show the chats it answers
  and add more. Only listed chats are answered (no catch-all), and a
  number allows up to 1,000.
- `design/runner/runner.md` ("Close") ended a session with `tmux
  kill-session` and took its hangup to end the agent. On 2026-11-21 one
  host ran out of memory with ~110 agents of closed sessions still
  running, because Claude Code ignored the hangup: the `pty` wrapper now
  kills its program's group 10 s after the hangup, closing a session
  confirms its processes are gone, and the daemon ends any agent left by
  a session that is over every 5 minutes. Nothing changed about tmux
  sessions it does not recognise (still reported, not reaped).
- `design/channels/answering-on-telegram-and-whatsapp.md` §5 (2026-11-20) woke a
  bot in a group only when a message @-mentioned the number or replied to
  it, and listed only the chats a number had seen a message in. On
  2026-11-21 the owner found a group set to a bot silent ("not answering")
  and People empty: a group the owner sets to a bot now wakes it on every
  message with words (up to 120 turns an hour per group; 20 stays a
  person's chat's), and the runner reports the groups the number is in
  and its saved contacts on connect and on each change (`whatsapp.chats`),
  so Settings lists them before anyone writes. The owner's own chat is
  listed first among People, answered by the default bot.
- `design/bots/bot-routines.md` §7 made the chat a routine's only
  editor: the Routines tab's Edit put "Edit your routine: *name*" in the
  composer. On 2026-11-21 the owner asked to edit one by hand: Edit opens
  a dialog for its name and prompt, and only when it runs (its triggers)
  is still changed in the chat.
- `design/console/voice.md` (2026-10-17) heard dictation on the ChatGPT sign-in
  or the deployment's `VOICE_STT_*` server, and bots spoke voice notes only
  on `VOICE_TTS_*`, all fixed by env. On 2026-11-21 the owner asked for it to
  be configured with the keys: Settings → Model providers adds Groq and
  ElevenLabs (voice only) and a Voice tab choosing, for the workspace,
  the transcription provider and model, the voice-note provider, model and
  voice, and the polish model or none. A choice is tried first, the old
  order after it; the env servers stay as the last provider.
- `design/bots/bot-routines.md` §8 slice E planned a routine's webhook as
  `POST /automations/webhook/{id}` with a key in `Authorization: Bearer`. Built
  on 2026-11-20 (#953) with the token in the URL instead,
  `POST /api/v1/routine-webhooks/{token}`, optionally signed with an HMAC
  secret, issued and revoked on the Routines tab, since the senders it is for
  are often given a URL and nothing else (the note's Decided, 2026-11-20).
- `design/channels/channels.md` §7.2 had one Oppenheimer Slack app per Slack
  workspace, speaking as each bot. On 2026-11-20, asked for a way to ask a
  bot from Slack (JordiParraCrespo/oppenheimer#954), each bot got an app of
  its own instead, so it has its own name and face and nothing routes by
  mention (`design/channels/slack-for-bots.md`): made from a manifest the console
  fills in, its token and secret pasted and sealed, answering only its
  owner's Slack user in the thread asked in. A channel turn that ends on an
  approval card now says so with a link, on Telegram and WhatsApp too.
- `design/bots/bots.md` §4.4 made every GitHub write of a bot's in the owner's own
  name (2026-10-20). On 2026-11-20 a bot became askable on GitHub (§3.3,
  issue #952), and its answer there is posted by Oppenheimer's App instead:
  it is told apart from what the owner wrote, and the App's comments wake
  nothing (`loopGuard`), so an answer never asks a bot again. The guide's
  "writing to a bot only in the console" stopped holding the same day.
- `research/visuals-in-the-chat.md` §6 and `research/generative-ui-in-chat.md` §6
  proposed visuals in the chat and left them unbuilt. On 2026-11-24 the
  owner asked for all of it: Mermaid and math in every chat's Markdown, one
  typed visual format (`@oppenheimer/shared/schemas/visual`) drawn by bots
  (`show_visual`) and sessions (`runner sessions show`, the runner's MCP
  `show_visual`), an `html` block run in a sandboxed frame on
  `visuals.<preview domain>` behind the `visual_html` flag, a permission card
  in the session chat, a form bots can ask the person to fill, a running
  command's live tail, and the chat's small markers. Picks taken where §8 of
  each asked: no chart library, the frame's network closed, a visual placed
  where it was called, and a link in a visual opening only once the reader
  says so. The owner kept HTML visuals on (2026-11-24) knowing one residue a
  page cannot close: a fragment's script that navigates its frame or inserts
  a frame is refused and the visual ended, but the browser looks the target's
  host up in DNS first; `visual_html` turns HTML off.
- `design/console/inbox.md`, "As built: the Inbox in Plan" (2026-10-29),
  made the Inbox Plan's first section at `/plan/inbox`, with no rail item.
  On 2026-11-24 the owner asked for it to be one of the platform's core
  features, with its own page, and as easy to answer and move on from as a
  swipe: it is the rail's first item again at `/inbox` (the Plan address
  redirects), with a dot and a count, and no sidebar, Plan opens on its board, and the reading pane is a deck of cards
  answered by number keys or a swipe ("Its own page, and a deck").
- `design/console/screens.md` said only opening a stopped session in the console
  brings it back (2026-11-24), so a bot whose session stopped idle had to ask
  the person to open it. The same day, after a bot did exactly that, a bot
  restarts a stopped session itself with `restart_session` (`design/bots/bots.md`), and
  `opp sessions restart` and the MCP server's `restart_session` expose the
  API's restart to people and agents elsewhere.
- `design/bots/bot-subscriptions.md` §4.2 had a bot's look at a task it handed off
  stay quiet (`nothing_to_report`) while the task was on track, so the chat
  showed only "Checked on session". On 2026-11-23, after the owner had to
  ask a bot whether the release it delegated had finished while it still
  ran, each look that finds the task moved says in one line where it stands; `notify` stays for
  what is off.
- `design/bots/bot-subscriptions.md` §4.2 said nothing but a subscription or the
  hourly heartbeat brings a bot back, so a bot was told never to promise to
  come back to anything else. On 2026-11-23, after a bot said it would
  verify a release before calling it done and went silent, a bot checks
  back on anything it delegated or waits on with `check_back` (§7.3): a look
  at a time it names, or on a backoff, for a day.
- The bots' prompt files were sorted by where their words are sent
  (`system/`, `turn/`, `wake/`, `jobs/`, `tools/`, 2026-11-18). On
  2026-11-23 they were sorted by capability instead, one folder each
  (`core/`, `mail/`, `sessions/`, `github/`…), the kind becoming the file's
  first word (`mail/tools-write.md`), so everything a bot is told about one
  area is in one place and a new area is a new folder
  (`apps/api/AGENTS.md`, "What a model is told is prose").
- A bot's how-to for a capability was a section of every turn's system
  prompt that offered the capability's tools. On 2026-11-23 the parts only
  some turns need became built-in skills, listed by one line and read with
  `use_skill` when the work comes up, as Codex and OpenClaw keep theirs:
  `watch-inbox` (mail), `use-a-computer` and `use-a-browser`. What must hold
  on every turn (ask before sending or buying, never type a password) stayed
  in the system prompt (`design/channels/mail.md`, Decided;
  `research/lessons-from-codex-and-openclaw-on-context.md`).
- Every bot tool went to Claude on every turn (`alwaysLoad`, "a bot's tools
  are few"); with every area on that is about 39,000 tokens of definitions,
  five times the system prompt. On 2026-11-23 a capability's tools became
  deferrable: on Anthropic's own API Claude Code's tool search defers them
  once their definitions pass about 5,000 tokens together
  (`DEFER_TOOLS_ABOVE_CHARS`; Claude Code's own `auto`, a tenth of the
  window, never deferred with a large window) and the model finds what it
  needs, while the bot's own tools (memory, skills, questions, notices)
  and the tools a built-in skill calls always load. GLM and the OpenAI engines send every tool as before.
- `design/channels/whatsapp.md` §3 kept an image on the phone, the bot told
  "[image]" and the caption, after voice notes became the one exception
  (2026-11-18). On 2026-11-24 the owner reported that the WhatsApp bots
  cannot see images: the runner keeps each image's media key and path for
  48 hours as it does a voice note's, and when the turn the image woke
  starts the API asks for it (`whatsapp.media.get`, `kind: "image"`), the
  runner scaling one past a link frame to a JPEG that fits; the bot's chat
  keeps the copy as an image of the message and the bot sees it.
- `design/console/inbox.md` counted a session as waiting on you once its agent had been
  blocked 30 s, measured from the runner's second report 15 s in, so a
  question reached the Inbox about a minute after it was asked. On
  2026-11-23 the 30 s went: a block a second report confirms is waiting on
  you at once, and the runner sends that report 3 s after the first
  ("A question reaches you in seconds"). Codex's and OpenCode's detection
  rules were rewritten from their real screens the same day.
- `design/channels/slack-for-bots.md` §4 cut a bot's Slack answer at 3,900
  characters, into several messages. On 2026-11-24, copying Orca's Slack
  fixes, an answer goes in one message up to 39,000 (Slack folds it behind
  "Show more"), the owner's message carries a 👀 reaction while the bot
  works, mentions arrive by name, secrets are redacted in what goes to
  Slack, and images the owner shares reach the bot (§1 said the bot reads
  only words); the manifest asks for `reactions:write`, `users:read` and
  `files:read` too.
- `design/sessions/agent-tools.md` §2 left a browser notification for later. On
  2026-11-24 the console raised one, opt-in per browser from the Inbox's
  filter menu, for each session that comes to wait on the reader and each
  agent notice, in a tab they are not looking at (`design/console/inbox.md`, "A
  notification in this browser").
- `design/console/inbox.md`, "Its own page, and a deck" (2026-11-24),
  put Done, Snooze, Deprioritize and Delete over the card and Later on it,
  with E, S, L and a swipe left for Later. The same day the owner asked for
  fewer choices: the card shows only its answers, a dock under it has
  Previous, Done and Next, a card that waits on an answer (a blocked
  session, a bot's approval) has no Done, a questionnaire goes one question
  at a time, and Mark as done takes up a task an agent made, as Dismiss did
  ("The card's actions, reshaped").
- `design/channels/answering-on-telegram-and-whatsapp.md` gave a contact's
  turn, and any turn in a group, no tools, so it could only ever answer in
  text, and a bot told to answer a group by voice never could. On
  2026-11-24 such a turn may answer as one voice note where
  `send_whatsapp_voice_note` would run in that chat without asking (a
  standing yes for the chat, or the tool allowed outright with no ask
  rule) and the
  workspace can speak: it is told so, marks its reply, and the reply goes
  as the note and never also as text, falling back to text when it cannot
  be spoken or sent (`design/channels/whatsapp.md`, 2026-11-24). It still gets
  no tools.
- `design/channels/answering-on-telegram-and-whatsapp.md` (2026-11-21) had
  every line with words in an allowed group wake its bot, and the bot
  answered every one, lines meant for others included. On 2026-11-25 the
  bot reads the group's last messages, works out who the new line is for,
  and keeps out of what is not for it by replying `[silent]`, which is
  sent to no one (§5, 2026-11-25). Every line still wakes it.
- The Chrome extension (`apps/extension`) told only about Claude Code cloud
  sessions, and sent Oppenheimer their states without reading anything
  back. On 2026-11-24, connected to Oppenheimer, it also reads the
  workspace's open sessions with the same token and tells, with a Chrome
  notification and its badge, each session on the person's hosts that comes
  to wait on them and each agent notice (`design/console/inbox.md`, "The Chrome
  extension tells about your hosts too").
- `design/console/screens.md`'s sidebar filter menu took one host. On
  2026-11-24 the owner, filtering to their Mac Studio, wanted a second
  machine beside it: the Host facet takes several hosts, as Repository
  does, a chip each, and lists a session on any of them.
- `design/console/inbox.md`, "Bulk actions" (2026-11-11), showed a row's
  checkbox only on hover, and the owner did not find it. On 2026-11-24
  Select in the list's head shows every checkbox, and X checks the item on
  the deck ("Selecting, found at a glance").
- `design/console/inbox.md`, "As built: the console" (2026-10-26), had
  Show done on by default, so a done item stayed in the list struck
  through. On 2026-11-24 the owner asked that it leave: Show done is off
  unless turned on in the filter menu ("Done leaves the list").
- A bot's `react` tool worked in its console chat only, refusing on a
  channel's conversation ("answer in words"). On 2026-11-24 the owner asked
  for the bot to decide its reactions on the channels too, keeping Slack's
  automatic 👀: it reacts on Slack as its app and on WhatsApp as the number,
  without asking, in a chat it answers (`design/channels/slack-for-bots.md` §4,
  `design/channels/answering-on-telegram-and-whatsapp.md` §4). Telegram still
  takes none.
- `research/device-streaming.md` ("A host's desktop") left the pointer to
  the screen-sharing server, and a watched Mac showed none: Apple's Screen
  Sharing sends the cursor's shape but never where it is. On 2026-11-24 the
  runner took that over: it reads the pointer with CoreGraphics and sends
  `desktop.pointer` while the reader watches (`design/foundations/protocol.md`),
  and the console draws the host's cursor there.
- `design/console/screens.md` drew a stopped session as a pane with a
  Restart button, and `design/runner/runner.md` §5 kept every session running until
  someone stopped it. On 2026-11-24, after reading how Orca hibernates
  agents (`research/session-resume.md`), opening a stopped session
  as its owner restarts it, and the button is the fallback for a restart
  that fails. The runner also stops, never closes, a session left `done`
  or `idle` and unwatched for two hours (`RUNNER_IDLE_STOP`).
- `design/console/inbox.md` ("You're all caught up", 2026-11-14) kept the
  list's empty state as one muted "Nothing needs you." row. On 2026-11-24
  the owner asked for more: the list shows "Inbox zero" over a check in a
  green disc, and "No matches" when filters match nothing ("Inbox zero").
- `design/bots/bots.md` (§1, "Its provider, model and effort") had a
  bot on Auto send no effort, so its turns ran at the model's own default.
  On 2026-11-25, after Oppie barely reasoned at GPT-6.2 Sol's `low` and
  widened a job it was given, Auto runs at a floor of `medium` on a model
  whose default is lower, and "How a turn goes" says to do what was asked
  and nothing more.
- `design/bots/bots.md` §4.2 kept a host's switches for bots
  (`runner exec`, `runner computer`, `runner browser`) on the host alone,
  never written by the control plane. On 2026-11-24 the owner, told by a
  bot to run `runner browser on` after saying "do it yourself", did not want
  that guardrail: a bot changes them with `set_host_settings` when the
  person asks in their own chat ("The host's switches").
- `design/runner/direct-terminal-path.md` (step 0) drew the keystroke
  round trip, `echo p50 / p95 ms · path`, in the session's bar when a
  `localStorage` switch was set, and gated each step on it. On 2026-11-24
  the owner did not want it in the header: it is gone, and the netsim
  bench times keydown to echo in the page instead.
- `design/console/inbox.md` ("A notification in this browser",
  2026-11-24) told only a session that comes to wait on you and an agent's
  notice. The same day the owner asked for more: a turn that ends (the
  row's blue dot) is told, a session left amber or blue for thirty minutes
  is told once more, and Mute notifications in a row's menu silences one
  session on this browser ("A finished turn, a long wait, and a mute").
- `design/console/inbox.md` ("A finished turn, a long wait, and a mute")
  put Mute notifications beside Mark as unread on a session row's menu.
  The same day the owner asked for a sublevel: both moved into a
  Notifications & read pane.
- `design/clients/mobile.md` ("A shell first", 2026-11-14) had each of the
  phone's five sections fill in a slice of its own. On 2026-11-18 the owner
  postponed the Pull requests tab: it stays a placeholder while the other
  four are built ("The Pull requests tab waits").
- `design/bots/bots.md` §5 gave a bot two levels: Approve for me (what
  reaches outside Oppenheimer asks) and Full access (everything runs, but
  trashing mail, archiving a project and a session at full access still
  asked). On 2026-11-25 the owner asked for an auto mode and a "dangerously
  skip permissions" mode, and chose the sessions' three levels: the old
  Approve for me is now Ask for approval (stored bots moved to it,
  unchanged), Approve for me is a reviewer that lets what the owner asked
  for run and leaves the rest on the card (`research/auto-mode.md`), and
  Full access raises no card but the owner's own Ask, an ask rule and
  sending mail ("three levels, and Approve for me is a reviewer").
- `design/clients/mobile.md` ("Native Liquid Glass, wherever the platform
  has it", 2026-11-15) named the tab bar, selects, back buttons and floating
  glass as the platform's. On 2026-11-25 the owner widened it to every
  control the platform has: switches, checkboxes, segmented controls, menus,
  alerts and sheets are SwiftUI's or Material 3's too, and the design
  system's JavaScript look-alikes (dialogs, popovers, dropdown and context
  menus, tabs, toggle groups, radio groups, the @gorhom bottom sheet) were
  deleted.
- The same day the owner asked for Material 3 Expressive on Android (Google's
  "Start building with Material 3 Expressive"): the native controls take the
  exact brand blue (#0071E3, kept exact by a patch to `@expo/ui`) instead of
  the wallpaper's colours, the list searches become Material's search bar,
  waits become Expressive's wavy circular indicator (not the shape-morphing
  one, which the owner did not like), the Android tab bar is quiet (icons
  only, ink on a soft grey pill) in the app's light or dark instead of
  Material's stock purple, and
  Run now becomes the one hero action, an extended FAB.
- `design/sessions/session-share-links.md` drew Share as a dialog that opened on Share session (who,
  permission, for how long) and switched to Sharing once shared, and the
  guest page as a narrow card under the wordmark. Share is now one panel,
  a popover off the session bar's Share button (the same panel in a dialog
  from a row's menu), whose choices apply to a live share as they are
  picked; the guest page is the session's own bar and a full-width
  terminal ("Share as a popover").
- `design/console/screens.md` and `design/bots/bots.md` called the middle
  permission level, sessions' and bots' alike, "Approve for me". It is now
  "Auto" (2026-11-27): the same level, stored as `auto`, under a shorter name
  the owner asked for.
- `design/console/session-tabs.md` drew a session's tabs 240px wide, and New
  session's plus took no room while it stepped aside, so the tabs narrowed
  when a session was created. Tabs are now 160px, and the plus keeps its room
  on New session ("no layout shift when creating a new session").
- `design/console/inbox.md` ("A finished turn, a long wait, and a mute",
  2026-11-24) told a session left amber or blue for thirty minutes with a
  browser notification. On 2026-11-27 the owner asked for that reminder to
  be an Inbox item instead: a session left unread (blue) for thirty minutes
  is listed as waiting to move forward, the notification is gone, and a
  check in the sessions sidebar's menu, on by default, turns it off ("A
  session left unattended is an Inbox item"); its card opens the session,
  streamed, to reply in, as a bot's notice opens the bot's chat, and a
  row's Mute notifications keeps that one session out of it.
- On 2026-11-26 the owner had `product/` restructured. It had three homes
  for design (the numbered notes at its root, `versions/mvp/`,
  `next-steps/`), and most of `next-steps/` was built. Now the design is
  `design/<area>/`, the MVP's notes keeping their numbers and the former
  next steps losing their version prefixes; the root `archive/vision-and-plan.md`, `archive/terminal-first.md`, `archive/targets-and-github-auth.md`, `archive/machines-and-vm-provisioning.md`, `archive/security-review.md`, `archive/github-experience.md`, `archive/multi-account.md`, `archive/mvp.md`, `archive/reuse-gha-runner.md`, `archive/github-app-install.md`, `archive/sleep-wake-and-pricing.md` and `archive/workspace-layout.md` are
  `archive/`; `research/reviewing-at-agent-speed.md` is research; the version order is `roadmap.md`; the
  three decision logs are this file; the design exports are `mockups/`, and
  the code behind research notes is `research/spikes/`. No decision in a
  note changed with the move.
- The same day, the owner had the numbers dropped as well. The design notes
  kept the MVP's numbers in the restructure (`02-runner.md`, cited as
  "02 §6"), and "note 04" meant a planning note: the same number could name
  two notes, and the citations read as a code. Now no note carries a number,
  and every citation is the note's path, relative to the note citing it
  (`../runner/runner.md` §6). Where a line was ambiguous, the note it meant
  was read from its context.

- `design/console/screens.md` had a member who could only request an
  organization's GitHub install connect it once an owner approved, by
  choosing the organization again. Since 2026-11-27 only the
  installation's own account or an owner of its organization can connect
  it (a security review: GitHub lists an installation for anyone with
  access to one of its repositories); the owner approves and connects it
  themselves.

- `design/foundations/auth.md` kept the starter's roster, invitation and
  team routes only out of the console. The server now refuses Better
  Auth's own `/api/auth/organization/*` writes too (2026-11-27, security
  review B): they answer 404, the façade is the one door, an invitation
  needs a verified email to accept, a replayed acceptance grants the
  member's current role, and leaving or being removed revokes the API
  tokens pinned to that workspace. Platform `admin` no longer holds
  `set-role` (review F).

- `design/bots/bot-subscriptions.md` (2026-11-03, the owner's call) let
  anyone who can comment on a followed pull request wake the bot, and
  `design/automations/automations-architecture.md` let any GitHub event on
  a watched repository fire an automation or routine. Since 2026-11-27
  (security review E) only events the repository's insiders cause (its
  owner, members and collaborators, by GitHub's `author_association`; a
  check only on the repository's own branch) fire a run or wake a bot or
  session; a stranger's issue, comment or review starts nothing, with no
  opt-out yet (`design/automations/automations-architecture.md`, "Insiders
  only"). `design/bots/bot-routines.md`: a routine webhook URL asked for
  through the API without `signed` is now signed, and a signed request is
  accepted once.

- `design/sessions/session-previews.md` named the preview's own cookie
  plainly and left the preview domain's site shared by every preview
  unsaid. On 2026-11-27, after a security review, the cookie is
  `__Host-oppenheimer_preview` (`Secure`, `Path=/`, no `Domain`), so a
  sibling preview cannot plant one, and the note advises a deployment to
  put the preview domain on the Public Suffix List, or give each preview a
  registrable domain of its own, because one app can still set a
  `Domain=` cookie every other preview is sent
  (`research/security-review-2026-11.md`).

- `design/bots/bots.md` said a bot cannot see an earlier message's images
  and asks you to send one again. On 2026-11-28 a bot asked about an image
  sent seconds before, on a turn that was not sent it, asked for it again.
  Since then a turn is still sent only its own message's images, but the
  bot looks at an earlier one again with `view_image`, by the id the
  history's note gives, only an image a message of that conversation
  carries (§3.1). A turn not offered the tool (a token
  without `bots:read`, a contact's turn) is told what it was before.

## The design

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
  plane is NestJS plus TypeORM, not Hono plus Drizzle (`design/foundations/control-plane.md`). The personal
  workspace is one `organization` row per account created at sign-up;
  the starter's leads and billing modules are not composed. foundations/auth.md
  added as the one-page auth note for the MVP.
- 2026-09-18: the notes and the code disagreed about whether the console
  creates organizations, and the notes were the stale half. `/onboarding`
  is the console's one organization-creating screen and stays: it is the
  recovery path for an account whose best-effort sign-up hook did not
  provision a workspace, it creates only the caller's own, and an account
  with none cannot open any product screen until it does. "No roster, no
  invitations, no teams" is unchanged. Recorded in foundations/auth.md, root
  `AGENTS.md` and `.agents/rules/rbac-roles.md`. foundations/auth.md also now
  records that provisioning is gated on *membership* rather than
  ownership, which the MVP cannot tell apart and the teams slice will.
- 2026-09-18: the runner is designed in full (`design/runner/runner.md`): one binary with
  subcommands, no inbound port and a 0600 Unix socket for the credential
  helper and the CLI, one multiplexed link with a 4-byte stream header on
  binary frames, a snapshot on reconnect instead of a durable outbox, and
  a package map onto `apps/runner`'s hexagon. That map answers `design/runner/runner.md`'s open
  question 6 and `design/foundations/protocol.md`'s open questions 3, 4 and 5. Pairing and the agent
  install prompt keep their decisions word for word but move from `design/runner/runner.md` to `design/runner/runner-install-and-update.md`,
  where the rest of the install story is.
- 2026-09-18: **signed self-update moves into the MVP** and gets its own
  note (`design/runner/runner-install-and-update.md`). It was in `design/foundations/scope.md`'s out-list as "signed auto-update"; a host that
  can only be updated by the user pasting a command again is a support
  burden the first ten hosts already cannot carry, and the protocol needs
  the update-required hint anyway. F26 therefore moves from deferred into
  `design/foundations/security-checklist.md`'s checklist. The shape: artifacts signed with an offline key whose
  public half is compiled into the binary, a manifest the control plane
  serves but cannot forge, a safe window, selfcheck before the swap, a
  health gate and automatic rollback.
- 2026-09-18: review pass on the design, and the notes moved to match it.
  `design/foundations/protocol.md` now owns the wire — `design/runner/runner.md` §4 had grown a second copy of it — and names
  the **attachment** (one PTY on one window for one browser connection)
  as what the 4-byte stream id identifies; the two sockets have two
  shapes on purpose. Registration, uninstall and the release manifest are
  ordinary HTTPS, which is what lets a runner the control plane refuses
  on protocol grounds still fetch the version that fixes it. `design/foundations/control-plane.md` takes the
  control-plane half `design/runner/runner-install-and-update.md` had been specifying from outside, and `design/console/screens.md` takes
  the host row (version, channel, pin, last outcome). `design/runner/runner-install-and-update.md`'s swap is a
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
  (`design/foundations/scope.md`, `design/console/screens.md`, `design/foundations/auth.md`). A session may span several repositories, one worktree
  each on its own branch (`design/foundations/scope.md`); the repository chip multi-selects with a
  branch pane per repository and the branch chip shows only for one
  repository (`design/console/screens.md`). Every scope chip filters. The agent chip lists Claude
  Code, Codex, OpenCode and a blank terminal with the vendors' published
  marks (Anthropic's Claude mark, OpenCode's square; none for Codex),
  and the model menu is scoped to the harness. The Add host dialog is
  the one dialog; the welcome modal is gone. Both themes. The design
  system grew the components these need (`ChipSelect` rebuilt on the
  Combobox primitive so it filters, `RepositorySelect`, `StepHeader`,
  `SlugInput`, `SuccessMark`, `SummaryCard`, `SegmentedControl`,
  `AgentMark`); the frames in `../mockups/version1/` remain the visual
  record and `design/console/screens.md` is the written one.
- 2026-09-19: **credential kinds are contributions to the auth kernel**
  (`design/foundations/auth.md`). `apps/api/src/auth` imported `api-tokens` and `users` to resolve
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
  these notes moved to match it. `design/foundations/protocol.md`'s open question 1 is **decided**: Zod is the
  source of truth for the wire and JSON Schema is emitted from it at build, with
  the Go structs generated from the committed artifact — one source, two
  languages. `design/foundations/protocol.md`'s "what rides the link" gains three messages the note had
  implied without naming: `events.append` with an `events.ack` that acknowledges
  **by idempotency key** (a WebSocket cannot tell "persisted" from "never
  arrived", so a batch is kept until every key is accounted for and resent
  otherwise), `attachment.credit` for the consumed-byte credit the flow-control
  section already required, and `credentials.grant` as the answer to
  `credentials.token` rather than an optional field on the ask. The hint
  vocabulary splits by socket: the link keeps three kinds and the attach ticket
  adds `host_offline`, which a connected runner could not coherently send about
  itself. `design/foundations/control-plane.md`'s "repositories (cached from GitHub)" becomes **not a table** —
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
  registration tokens and cannot rotate a key, and `design/runner/runner-install-and-update.md` §3 already places
  rotation on an authenticated link. Recorded in `design/foundations/protocol.md`, `design/foundations/control-plane.md` and
  `apps/runner`'s pairing client.
- 2026-09-19: **a project is the body of work a session belongs to**, and the
  layout gains a level. `design/foundations/control-plane.md`'s data model lists `projects` and says a session
  belongs to one; `archive/workspace-layout.md`'s §1 is superseded at the top by
  `workspaces/<organization.slug>/projects/<project.slug>/{repos,sessions}`,
  because a session may check out several repositories and the old tree had
  nowhere to put the second one. `archive/workspace-layout.md`'s collision rule is unchanged and now names
  the project's directory: the repository's own name, or `<owner>--<repo>` when
  another repository already holds it, then `<owner>--<repo>-<githubRepoId>`,
  which is where a rejected random suffix used to be — every candidate is
  derived from the repository, so a directory can always be read back to what
  created it. A project is created by the first session that needs one, found
  again by GitHub's repository id (unique per workspace, and the conflict target
  of the create), and its slug is immutable because it is a directory name on
  every host holding it.
- 2026-09-19: the **`github/` module is built** and `design/foundations/control-plane.md` gains the section that
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
  `design/foundations/auth.md` said a host row carries the workspace id; it now carries
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
  it names must be one its creator owns or holds a grant on. `design/foundations/auth.md`'s open
  question 2 is **decided** with it — the pairing token is bound to the
  user who minted it, and the host it creates is theirs. Recorded in `design/foundations/auth.md`,
  `design/foundations/control-plane.md`, `design/runner/runner-install-and-update.md` and `apps/api/src/hosts/`. A host's key is a **column on the host
  row** rather than a `host_keys` table, and the retired key joins it as a
  second column when rotation arrives on the link: rotation needs exactly
  two keys, never N, and every runner boot reads them.
- 2026-09-20: the host's boot assertion becomes a **contributed credential
  kind**: `apps/api/src/hosts` spreads
  `AuthModule.contributeCredentials([HostCredentialResolver])` into its own
  providers and is no longer `@Global`, so the auth kernel recognises a machine
  without importing `hosts`. The kind's *shape* stays kernel vocabulary —
  `ScopeContext` gains a `host` variant with no owner and no scopes, because the
  guards read it — and nothing about what a host may do changed. Recorded in `design/foundations/auth.md`
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
  (`design/console/screens.md`).
- 2026-09-21: the first-run flow is **wired and reachable**. Sign-up
  opens `/onboarding/workspace` rather than the console, step 2 claims
  the workspace the hook provisioned (renaming it; creating only for an
  account that has none), and the gate off the step is whether the
  address has been claimed rather than whether a workspace exists (`design/foundations/auth.md`).
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
  drawer arrives (`design/console/screens.md`).
- 2026-09-21: **the New session screen's controls get API fields**, in
  the four notes that own them (`design/foundations/protocol.md`, `design/runner/runner.md`, `design/foundations/control-plane.md`, `design/console/screens.md`) rather than a note of
  their own. The composer's foot row sets a model, a permission level and
  an effort, and the composer itself is the session's first task, so
  `POST /sessions` and `session.create` both grow `launch` and `prompt`
  (`design/foundations/control-plane.md`, `design/foundations/protocol.md`). One of those changes `design/foundations/api-modules-and-data-model.md`: the launch is **folded into
  columns** on `work_session` rather than living only in the log — the
  promotion `design/foundations/api-modules-and-data-model.md` said would be "a replay, not a backfill" — because
  `restart` has to relaunch a session the way it was launched and would
  otherwise walk its log to find out. The flag strings each permission
  level and effort stop maps to are catalog data beside `command`, read
  off each CLI's own `--help` at implementation time rather than written
  from memory. **The first task is a launch option, not something typed
  at a running process**: the runner appends it to the agent's argv,
  which both CLIs document as a trailing positional, so there is no
  "the TUI is ready" moment to race with (`design/runner/runner.md` §5). Exactly one end writes
  `prompt.first` — the control plane when the composer supplied a task,
  the runner off the transcript when it did not — so the two writers
  never need a shared key (`design/runner/runner.md` §7). The namer gains an
  `openai-compatible` provider — one adapter for Groq, Together, vLLM,
  Ollama and the rest — so a session is named by a fast open-weights
  model, never on the critical path of creating it. `design/console/screens.md`'s first open
  question, how a session is named, is closed by the same change.
- 2026-09-22: **Add host is armed on a registered host, not an online
  one** (`design/console/screens.md`). The dialog picks the machine a session will run on, and
  the control plane already records a session against a host whose
  runner is still coming up — that is what the create response's
  `host_offline` hint and the chip's offline rows mean (`design/foundations/protocol.md`, `design/foundations/control-plane.md`). The
  onboarding step keeps waiting for `online`, because a first-run flow
  that ends on a machine which never came up has claimed something the
  console cannot use. The step's capability card (✓ git, ✓ tmux) stays
  on the artboard until the wire carries a host's tools: the status row
  says the runner is connected, or that it is still coming up, and
  nothing more.
- 2026-09-22: **shown-once covers the whole first-run flow**, not only
  the step that names the workspace (`design/foundations/auth.md`). The landing could be re-opened
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
  lives in `CODING_AGENTS` and nowhere else — `design/console/screens.md` says "the harness's
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
  is (`design/console/screens.md`). The same change names the console's keymap in `design/console/screens.md`, and moves
  resize coalescing to the console at 50 ms, with the runner applying
  each size as it arrives (`design/runner/runner.md` §5, §7).
- 2026-09-23: **multi-host behaviour is proved through the real register
  path, in the cheapest place that is honest about it.** A test that needs a
  host pairs one the way a user does — mint, `runner register`, the link —
  rather than writing a host row, and it runs in the lowest tier that can
  prove the property: containers for pairing, routing, link loss and
  adoption; a real OS only for what a container cannot fake (`design/runner/runner-install-and-update.md`'s service
  units, linger, the signed swap; `design/foundations/step-one-spike.md`'s gate). Recorded in `design/foundations/api-implementation-plan.md`, slice 6.
- 2026-09-23: the provisioning pane draws the host's own steps, from
  `session.step` on the log (`design/foundations/protocol.md`, `design/console/screens.md`).
- 2026-09-23: **a session is one repository in the MVP** (#56). 2026-09-19's
  several repositories per session is deferred to the runner slice that
  makes several worktrees (`design/foundations/api-implementation-plan.md`'s R3): the runner makes one, and a session
  that asked for two was accepted, refused by the host and left spinning.
  The create body takes at most one checkout, adding a second is
  `SESSIONS_010`, and the composer's chip holds one (`design/foundations/scope.md`, `design/console/screens.md`, `design/foundations/api-modules-and-data-model.md`). With
  it, a runner's refusal of a session command is recorded on the
  session's log instead of dropped, so a start the host refuses fails
  visibly (`design/foundations/control-plane.md`).
- 2026-09-23: **a session is named by a model if it is quick, by its prompt's
  own words if not, and create waits for the name** (`design/foundations/control-plane.md`, "A session is named
  from its first prompt").
- 2026-09-24: **OpenCode and the blank terminal join the catalog, and Opus
  5.5 is the Claude default** (`design/foundations/scope.md`, `design/foundations/protocol.md`, `design/runner/runner.md`, `design/console/screens.md`). Four agents launch, not
  one plus placeholders (`design/foundations/scope.md`); `session.create` names any of the four and
  carries no permission level for the blank terminal (`design/foundations/protocol.md`); a permission
  level is one object of argv and environment, which is how OpenCode's
  `OPENCODE_PERMISSION` reaches window 0 only, the login allowlist is
  generated per agent from the catalog, and the host probe lists
  `codex` and `opencode` (`design/runner/runner.md` §5, §9, §10); the composer table and the
  hide-and-do-not-send rule are `design/console/screens.md`'s. The model seed follows Synara's
  model table and Orca's pricing table.
- 2026-09-24: **a pasted or dropped image reaches the agent**: the console
  uploads it, and the runner writes it outside the worktree and pastes its
  path into the prompt (`design/foundations/protocol.md`, `design/runner/runner.md` §11, `design/console/screens.md`).
- 2026-09-24: **connecting a host is hardened** (`design/foundations/protocol.md`, `design/runner/runner.md`, `design/foundations/control-plane.md`, `design/console/screens.md`, `design/runner/runner-install-and-update.md`).
  - An unpaired host is **terminal**: it gets no link, loses the one it
    has, and its runner stops dialling rather than retrying forever.
  - Uninstall is **refused while the runner's sessions run**, as `design/runner/runner-install-and-update.md` §4
    promised; ending them is an explicit `--force`.
  - The registration token is **not an argument** of anything the runner
    or the installer runs.
  - The installer **asks before installing anything**, on the terminal,
    and stops before the token is spent when a tool is missing; this
    replaces `design/runner/runner-install-and-update.md` §2.6's "decline and carry on".
  - A machine that **looks temporary is refused** unless the person says
    otherwise.
  - A person holds **a small number of unspent tokens**, and the owner is
    **told when a machine pairs**.
  - First install stays **trust-on-first-use**: the digest on screen is
    the check, and signature checks begin at the first self-update (F26a).
  - Key rotation stays with the link, as 2026-09-19 decided; the release
    manifest's lack of an expiry is an accepted risk (`design/runner/runner-install-and-update.md` §7).
- 2026-09-25: **Grok joins the catalog** (`design/foundations/scope.md`, `design/foundations/protocol.md`, `design/runner/runner.md`, `design/console/screens.md`): one more row in
  `CODING_AGENTS`, defaulting to Grok 4.6 because that is its CLI's default,
  with a screen manifest that is provisional until a soak. A session for an
  agent the host's runner never probed is refused at create rather than
  failed at launch, so a new row needs no protocol bump (`design/foundations/protocol.md`).
- 2026-09-26: **the project is on the console** (the MVP's twelfth note, reversing `design/foundations/api-modules-and-data-model.md`'s "the MVP
  never shows a project chip"). New session is the export's tabbed
  composer with a project chip first, whose foot row makes a project in a
  dialog: a name, default repositories with a base branch each, a default
  host and a default agent, which prefill the other chips. The API grows
  `POST /projects`, the two defaults and a `project_repository` table; a
  project made in the dialog has no origin, so the auto-created path for
  callers that send only checkouts is unchanged. The grouped sidebar and
  the row menu are the next slice. (The MVP's twelfth note was folded into `design/console/screens.md` and
  `design/foundations/api-modules-and-data-model.md` and deleted the same day; the entries below changed most of it.)
- 2026-09-26: **a session's paths keep the project that created it.** A
  session moves between projects (`POST /sessions/{id}/move`, one
  `session.moved` event the row folds, `design/foundations/control-plane.md`), and its worktree and branch do
  not: `work_session.projectSlug` snapshots the directory name at request,
  and every later launch reads it from the row rather than from the project
  the session is in now. (Reversed the same day: the layout lost its
  project level, so a move touches nothing on disk and there is no slug to
  keep; see the entry on projects as metadata below.)
- 2026-09-26: **Settings is a page, not a drawer.** The export draws it
  beside the console, opened from the account menu: `/settings` with
  Profile and Hosts as sections, Add host opening the console's one
  pairing page with `?from=settings`. It goes through the console's guard
  and no-workspace redirect and draws its own chrome. The drawer `design/console/screens.md`
  described for hosts is gone; the host card's rows come with the hosts
  slice (`design/console/screens.md`).
- 2026-09-26: the version-1 frames gained a Settings page with a Hosts
  section, and the hosts backend is designed against it (`design/runner/hosts-settings.md`). A host
  read now carries a derived `status` and the count of sessions running
  on it; `GET /hosts` leaves unpaired hosts out unless asked; removing a
  host stops the sessions running on it, where unpairing used to leave
  them `open`; `GET /hosts/pairing/{id}`, listed in `design/foundations/api-modules-and-data-model.md`, is built and
  returns the host the token paired; the runner reports its CPU count.
- 2026-09-26: host metadata moves off the `host` row (`design/runner/host-metadata.md`). What the
  machine is goes to `host_inventory` (written only when its facts
  change), whether it is there to `host_presence` (one narrow row
  rewritten per heartbeat), where it connects from to `host_network`
  (public addresses as the API saw them, kept 90 days), and what changed
  to `host_event` (append-only, 180 days). Heartbeat history is
  deliberately not stored. `host` keeps its old columns until the code
  switches over (expand, switch, contract).
- 2026-09-26: `design/runner/host-metadata.md`'s two open questions are settled. Geography comes from
  DB-IP Lite (free, no account), and the owner is emailed about a new
  network only when the host's country or ASN changes.
- 2026-09-26: **Add host from Settings stays in Settings.** It opens the
  Add a host page at `/settings/hosts/new`, inside the Settings frame with
  its Back, as the frame draws it — not a dialog, and no longer the
  console's page with `?from=settings`. The console keeps `/hosts/new`;
  both mount the one screen. Copy host ID is left out of the host menu
  for now (`design/runner/hosts-settings.md`).
- 2026-09-26: `design/runner/hosts-settings.md`'s first open question is settled: the host card's
  location slot, drawn as "eu-west" / "local", shows the city and country
  code of the host's connecting address from DB-IP Lite (`design/runner/host-metadata.md`).
- 2026-09-26: **a project is a saved scope a person creates, and metadata
  only** (`design/foundations/scope.md`, `design/foundations/protocol.md`, `design/runner/runner.md`, `design/foundations/control-plane.md`, `design/console/screens.md`, `design/foundations/api-modules-and-data-model.md`, `design/foundations/api-implementation-plan.md`). It holds repositories (each on a base,
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
  rail is whole; automations themselves stay after the MVP (`design/foundations/scope.md`, `design/automations/automations.md`).
- 2026-09-27: **the automations sidebar leaves out Unassigned**: an
  automation is set up for a project, and Unassigned only holds the
  sessions that name none (`design/automations/automations.md`).
- 2026-09-27: Settings → Profile is specified in `design/console/screens.md`; credential writes
  (password, email, devices, deleting the account) are session-only (`design/foundations/auth.md`).
- 2026-09-27: **a session checks out exactly one repository in the MVP.** A
  session with none was accepted, then refused by the host at launch
  (`SESS_002`) and shown as failed. The create body now takes one checkout,
  no fewer, and the console's composer stays disabled until a repository is
  picked. A session with no git returns when a runner can make one (`design/foundations/scope.md`, `design/foundations/api-modules-and-data-model.md`).
- 2026-09-27: **nothing open is New session**: the console lands on
  `/sessions/new`, and `/sessions` redirects there, instead of a "no
  sessions open" pane (`design/console/screens.md`).
- 2026-09-27: **New project, Project settings, the console's Add a host
  and the automation editor are dialogs over the console again**, as the
  2026-09-27 export draws them; the `_editor` pages of 2026-09-26 are
  gone. Settings keeps its Add a host page. Add a host copies first —
  Copy install command, Copy agent prompt — and shows the instruction
  behind an Inspect fold, in the console and in onboarding; the
  automation editor holds its Task step alone until the API names a
  trigger (`design/console/screens.md`, `design/automations/automations.md`).
- 2026-09-27: organization routes are authorized in the organization they name (`design/foundations/auth.md`).
- 2026-09-27: **automations move into the MVP** (`design/foundations/scope.md`, `design/automations/automations-architecture.md`). A run is a
  headless session for any agent in the catalog, translated in the API;
  `sessions/` owns execution (`session_turn`) and `automations/` only the
  firing (`automation_run`); a run acts as its owner; external events go
  through a provider-neutral `inbound-events/` hub; schedules are rows
  fired by a one-minute tick; guards and limits are configurable at three
  levels. `design/automations/automations.md`'s open data-model question is closed.
- 2026-09-28: **the per-host cap counts live runs, not headless turns**,
  since runs are interactive sessions until the headless drive (slice 2);
  a run whose first turn ended holds no place, one past the run limit is
  stopped, and the disk floor defers. **A run opens at
  `/automations/$automationId/sessions/$sessionId`**, the session pane
  with the automations list kept (`design/console/screens.md`, `design/automations/automations.md`, `design/automations/automations-architecture.md`).
- 2026-09-28: `design/runner/runner.md` §5's store was a `git clone --bare` refreshed by
  fetching every branch. It is blobless with no working tree, a create
  fetches only the ref its worktree is made from, and each repository
  keeps one spare worktree checked out ahead of the next create (`design/runner/runner.md`).
- 2026-09-28: **Settings is two sliders, not a cog** (`design/console/screens.md`). The
  version-1 export's `settings` glyph is lucide's `settings-2`, so the
  account menu's link and a project header's action both draw it, and
  `design/console/screens.md`'s "cog" is gone. `design/console/screens.md` now keeps the glyph map: folder for a project,
  an arrow out for a foot action that opens another site, `Callout` and
  the Auto shield kept against the export, with the reasons.
- 2026-09-28: **The GitHub App install redirect carries a console-minted
  state** (`design/foundations/control-plane.md`, `design/console/screens.md`). An addition, not a reversal: `POST /installations`
  now requires the single-use `state` that `POST
  /installations/install-state` minted for the caller in the workspace,
  so a forwarded callback can no longer connect someone else's
  installation (`GITHUB_011`). Both install entry points mint on click;
  `github_app_install_url` stays as the capability that says an App
  exists. The first-run walk rides as the state's prefix,
  `first-run.<nonce>`.
- 2026-09-29: **Effort is each CLI's own levels, per model** (`design/foundations/protocol.md`, `design/runner/runner.md`,
  `design/foundations/control-plane.md`, `design/console/screens.md`). The slider was five product stops that each agent mapped
  onto its flag, which put "Medium" on a Claude Code launch of `--effort
  high` and sent Codex a `minimal` no model takes. The catalog now spells
  effort once per agent and lists each model's levels and default; the
  slider draws those, starts on the default and sends nothing until
  moved, and OpenCode takes a level as the model's variant.
- 2026-09-30: **The session grid's line height is 1.3** (`design/console/screens.md`). A departure
  from the export's 1.55 and from the earlier xterm value of 1: xterm
  stretches block and box glyphs to its cell, so 1.55 elongated Claude
  Code's mark and 1 packed a turn. The HTML terminal keeps 1.55.
- 2026-09-30: **The reader's messages in the session grid are drawn as the
  export's bubble** (`design/console/screens.md`). Found by Claude Code's own user-message background
  and pointer, repainted in the terminal's ramp, with the tint laid over the
  grid; the input row stays the agent's own.
- 2026-09-30: **The dark session terminal is the artboard's `#1a1a1c`, frame
  included** (`design/console/screens.md`). It had been set to the canvas (`#121213`) because the
  lighter terminal read as a slab on a darker page; the artboard paints the
  session's frame in the terminal colour too, so the console now does the same
  and matches it.
- 2026-09-30: **The terminal answers the line, word and select-all chords
  a desktop terminal does, and Ctrl+Shift+C copies off the Mac** (`design/console/screens.md`).
- 2026-10-01: **`session.started` means the session has a terminal, not that
  its agent is up** (`design/foundations/protocol.md`, `design/runner/runner.md`). The host builds the tmux session before it
  clones, so the pane exists about thirty milliseconds in and the clone, the
  worktree and the agent follow it. The console attaches on this, which puts
  the reader in the terminal while the repository is still arriving; the
  `agent` step is what says the agent was launched. The terminal is a stage
  like the others but has no step on the wire — the stepper stays
  `host/clone/worktree/agent`.
- 2026-10-01: **An attach is served while its create is still running, and is
  the only command that does not use the session's lane** (`design/foundations/protocol.md`, `design/runner/runner.md`). It needs
  the tmux name and nothing else. Queued behind the create it sat out the
  clone and the agent launch — the cost that building the terminal first
  exists to remove — so it waits on the session's own terminal instead.
  Everything else still waits for the create to land: a stop sent during a
  create is answered after it, which is what keeps stop, list and unpair
  seeing one consistent set of sessions.
- 2026-10-01: **A session's worktree lives in a hidden directory**
  (`<repo>/.worktrees/<slug>`, `design/runner/runner.md`). Spotlight does not descend into a dotted
  directory, and a worktree is a whole checkout written at once: left
  visible it is indexed while the agent starts, and the agent's file reads
  queue behind the scan. Two worktrees of the same commit in one parent, run
  interleaved: `wt` 30.2s, `.wt` 5.7s, `wt2` 31.5s to the agent's first
  token. `.metadata_never_index` at the workspaces root does not work —
  `mdls` still returns indexed metadata underneath it.
- 2026-10-01: **One session's row polls faster than the session list while it
  is starting** (`design/console/screens.md`). The list keeps one pace; the row a reader is watching
  opens at 300ms and settles to 2s after 3s. The opening phase belongs to the
  row and not the list because its clock is kept per query and the list is one
  query for every session — a second session started during the first one's
  clone would otherwise inherit the first one's settled tick.
- 2026-10-02: **A host gets the repository ready while New session is still
  being written** (`design/foundations/protocol.md`, `design/runner/runner.md`, `design/console/screens.md`). Picking a host and a repository sends
  `repository.prepare`: the store cloned or fetched and a spare worktree
  made, with a token minted for that repository and sealed into the command
  because no session exists to ask for one. Measured from the browser on a
  host that had never seen the repository, with ten seconds between the pick
  and Send: microsoft/vscode 32–34 s → 0.89–0.93 s, facebook/react 7.8 s →
  1.0–1.1 s to the agent's first screen (`research/session-boot-time.md`).
- 2026-10-02: **The first clone is shallow, and the history follows in the
  background** (`design/runner/runner.md` §5). A worktree needs the base's one commit, not the whole
  history: on microsoft/vscode the store is ready for a spare in 9.3 s
  instead of 25.8 s. The deepen ends at the same blobless store as before, so
  a session's `git log` and `blame` work as they did once it lands.
- 2026-10-04: **A session takes files, not only images** (`design/foundations/control-plane.md`, `design/foundations/protocol.md`, `design/runner/runner.md` §7, `design/console/screens.md`,
  `design/foundations/security-checklist.md`). Images, PDF and UTF-8 text, one allowlist judged by the bytes at the
  API and again on the host; text is text only when it is valid UTF-8 with
  no control bytes and opens neither with `#!` nor as HTML, SVG or XML.
  Executables, archives and scripts are refused whatever they are called,
  and the runner names every file `<id><extension from the table>`. The
  wire keeps its `image` names; a runner that takes more says so with
  `session.files`, and one that does not is sent images only.
- 2026-10-05: **Plan is in the MVP** (17–20). The export drew a third
  rail item: a board of tasks with goals over it, tasks that start or
  link sessions, and a month calendar. The owner decided it ships in the
  first version, absorbing what `roadmap.md` called 0.3 Kanban; Google
  Calendar is read-only first, personal events stay, only attaching a
  session moves a card, and Queued is a console label.
- 2026-10-05: **Plan ships live, as built** (`design/plan/plan.md` "As built"). No `plan`
  flag; no `GET /tasks/summary` (the board's read serves the counts); a
  session started from a task is a person's, linked with `started`; the
  calendar computes automation runs from the automations list; event
  times are wall-clock; archiving a project is not blocked by its tasks.
- 2026-10-06: **The shell draws every console page, on the export's
  grey.** A route names its measure, one of the export's widths; `full`
  is only the session terminal. The rule is
  `.agents/rules/frontend-architecture.md`, "The page frame is the
  shell's".
- 2026-10-06: **The console hears about changes from one event stream,
  and stands down the polls it covers** (`design/foundations/control-plane.md`, `design/console/screens.md`). `GET /v1/events` streams
  invalidations (`session.changed`, `host.changed`, `pairing.spent`,
  `automationRun.changed`) per workspace and per person over Redis
  pub/sub, published from the outbox after each commit. While a stream is
  live, the polls in `LIVE_POLL` whose facts it carries (sessions, their
  start steps, a pending pairing token) stand down, and they poll again the
  moment it drops; presence and a run's status keep polling. A stream ends
  when its replica's Redis subscriber connection closes, and every time one
  comes up, the first connect included, the reads it covers are refetched
  once. Behind the `workspace_event_stream` flag.
- 2026-10-08: **A session can be shared with a link** (`design/sessions/session-share-links.md`, `design/foundations/auth.md`, `design/foundations/protocol.md`). A link
  watches or types, and opens for anyone, any signed-in account, or the
  accounts it names by verified email. It acts as the member who made it,
  re-checked as their terminal is, so it never opens more than they could;
  read-only is held by the relay and by tmux (`session.attach` gains
  `readOnly`). The secret is stored as a digest and travels in the URL
  fragment and request bodies only.
- 2026-10-08: **A link that lets anyone type expires within seven days**
  (`design/sessions/session-share-links.md`). The API, the aggregate and a `CHECK` refuse a longer one, or one
  with no expiry; every other link may still live until revoked.
- 2026-10-11: **the terminal gets a direct path, and predicts what is
  typed** (`design/runner/direct-terminal-path.md`, `design/foundations/protocol.md`, `design/foundations/step-one-spike.md`). Every keystroke crossed the relay twice, so a
  reader beside their own host paid two round trips to the control plane.
  Built: the round trip is measured in the browser, and a character typed
  at the cursor, Backspace, Left and Right are drawn before the echo in an
  overlay, dropped the moment the host disagrees, behind the
  `terminal_typeahead` ops flag. Decided, not built: a WebRTC data channel
  per attachment from browser to runner, signalled over the attach socket
  and the link, opened after the relay path and falling back to it with a
  tmux repaint rather than a replay; the relay still admits every
  attachment, and on the direct path read-only is the runner's to hold.
  `design/foundations/protocol.md`'s "the browser never reaches the runner directly in the MVP" is
  superseded by `design/runner/direct-terminal-path.md`.
- 2026-10-11: **the direct terminal path is built, behind
  `terminal_direct_path`** (`design/runner/direct-terminal-path.md` "As built", `design/foundations/protocol.md`). Three points changed while
  building it, each marked in `design/runner/direct-terminal-path.md`: a path switch is a **byte offset** said
  on the control path, not a marker on the old one, because the link sends
  control frames ahead of queued PTY frames; the data channel is **binary
  only**, credit and resize staying on the attach socket; and a channel
  that closes sends the attachment **back to the link** with the tmux
  client repainted by `SIGWINCH`, not `refresh-client`, and without closing
  the attachment, which the browser would take as the session ending.
  No trickle ICE, no share-link direct paths yet, and ICE servers come from
  `RELAY_ICE_SERVERS` (empty: host candidates only) until the STUN
  responder exists.
- 2026-10-11: **the direct path's STUN is Cloudflare's** (`design/runner/direct-terminal-path.md`, open question
  1). The dev deployment sets `RELAY_ICE_SERVERS=stun:stun.cloudflare.com:3478`
  rather than run a responder of its own, which would need UDP 3478 published
  and so an exception to the rule that nothing on the server publishes a
  port. `design/runner/direct-terminal-path.md` said no third-party STUN by default; Cloudflare already carries
  every request through the tunnel, so it adds no party, and it is free.
- 2026-10-11: **Delete is optimistic, and a session gone from its host
  closes** (`design/console/screens.md`, `design/runner/runner.md`). The sidebar drops the row on the click and puts it
  back if the close cannot happen; the toast that the host was asked is
  gone. The runner answers a close or a restart for a session it holds no
  record of, one it closed already, or one whose worktree was deleted by
  hand with `session.closed` (a restart is still refused), so the row
  resolves rather than being stuck forever.
- 2026-10-13: `design/plan/plan-milestones-stats-accounts.md` plans Plan's second cut from the 2026-10-13 frame. The
  owner decided: goals are renamed milestones all the way down; blocked
  is a field on a task; token and cost stats are built now on headless
  turns; Stats ships without pull requests first; each Google account
  gets a colour and a toggle of its own, five at most. Who draws the
  Stats screen, this plan or the agents', is open.
- 2026-10-13: Plan's second cut is built (`design/plan/plan-milestones-stats-accounts.md` "As built"): milestones
  everywhere, the event log with versions and actors, blocked tasks, the
  Milestones and Stats views (Stats is Plan's own view, settled when the
  owner asked for the whole screen without the agents), several Google
  accounts. Tokens and cost wait on the runner's headless drive.
- 2026-10-13: **Sharing a session follows the `ShareSession` design** (`design/sessions/session-share-links.md`,
  `design/foundations/auth.md`, `design/runner/direct-terminal-path.md`). The bearer links of 2026-10-08 are replaced by one share per
  session at one stable address, `/s/<slug>`, which the dialog shows and
  copies every time: named people by verified email, or anyone signed in
  with the address. Nothing opens signed out. A link only watches; write
  access names people, lasts 24 hours at most, and is given only after the
  sharer ticks that they understand the guest acts as them. Lifetimes are
  1h, 8h, 24h, 7d or never. Share opens from a row's menu and the status
  line; the guest page is one bar and the terminal. Presence is not built.
  Existing links were dropped, and `SESSIONS_024` is retired.
- 2026-10-13: **Add a host is agent first**, in onboarding and in the
  console's dialog, as the 2026-10-13 export draws it: the agent prompt
  with Copy prompt, the command behind "Install manually instead", and a
  Connection list (Runner installed, Host connected) in place of the one
  status line. Tools on PATH waits for the wire to carry a host's tools.
  Settings keeps its page with both forms in one panel (`design/console/screens.md`).
- 2026-10-14: **A session runs in a new worktree or in a folder on the
  host** (`design/sessions/session-places.md`). The work folder is `~/oppenheimer/` by default and holds
  `<account-id>/<workspace-id>/{repos, agents, sessions}`, bare stores
  under `repos/`, a `.oppenheimer/` folder in every folder the runner
  made; the old `~/oppenheimer-ai/workspaces/<repo>/` layout is dropped
  without migration. A folder session's folder is the person's: nothing is
  cloned, nothing is written, closing it ends the terminal. The blank
  terminal is an agent in either place. New session opens on `auto` and
  remembers the permission level.
- 2026-10-14: **The first bot is a general one** (`design/bots/bots.md`): created blank,
  shaped by chat and settings, a headless turn per message on its home
  host. Inside the product it is a bot; the nav keeps Employees. No
  templates and no built-in bots yet, and no photos of people as avatars.
- 2026-10-15: **A bot's loop moved into Oppenheimer** on its provider's
  agent SDK, with owner-set tool permissions and bots that edit
  themselves; see [`bots.md`](design/bots/bots.md) "Decided".
- 2026-10-22: **a bot follows a session it delegated with a subscription** (`design/bots/bot-subscriptions.md`, issue #445): a `bot_subscription` row whose wakes are queued turns keyed once per task and state, re-reading the session as the owner. It changes `design/bots/bot-routines.md`'s "no watch table" for a bot's own sessions; `design/bots/bot-routines.md` §5's trigger stays for automations.
- 2026-10-25: **the Inbox starts minimal** (`design/console/inbox.md`): only what the system already knows, composed in the console from existing reads, nothing stored; agents posting into it, the message box to a general bot and Claude Code questions in the Inbox come later.
- 2026-10-26: **the Inbox stores your marks** (`design/console/inbox.md`): the 2026-10-26 export adds Mark as done, Deprioritize, Snooze and Delete on every row, so an `inbox_mark` row per item occurrence is kept, keyed so a new wait comes back; the items themselves are still not stored. Each item carries its project for the frame's project filter.
- 2026-10-26: **the Inbox is built in the console** (`design/console/inbox.md`, "As built"): a failed or stuck session is keyed by its lifecycle's change count rather than `observedSince`, which only a blocked agent has; the API reports both and a pull request row's head commit.
- 2026-10-29: **the Inbox moves into Plan and reads like mail** (`design/console/inbox.md`, "As built: the Inbox in Plan"): Plan's first section at `/plan/inbox`, no rail item, the console still lands on it; a list column with search and unread rows beside a reading pane with a toolbar; the visit's log and the greeting are gone.
- 2026-11-09: **the Inbox takes reports with pictures, and answers them** (`design/console/inbox.md`, "Reports"): a stored `inbox_report` that anything with an `inbox-reports:write` token posts, with up to four images; the owner answers in the card under `inbox:write`, and the sender reads the answer by asking. The first Inbox item that is stored.
- 2026-10-26: **a bot's chat queues what you write while it works and shows the room it has left** ([`bots.md`](design/bots/bots.md) §2): waiting messages over the composer with Remove, Edit and Send now, and the context meter with a ChatGPT sign-in's plan windows; the meter is no longer "not built yet".
- 2026-10-26: **bots show in the console's sections** (`design/bots/bots-in-sections.md`): a set of sections on the bot, chosen by its owner, the section's plus or the bot itself, lists it under a Bots heading in Sessions, Automations, Plan and Pull requests; Pull requests opens its chat in place. Not derived from permissions, which are not built yet.
- 2026-10-26: **a session checks out several repositories again, up to
  five** (`design/foundations/scope.md`). 2026-09-23's one repository per session (#56) is lifted:
  the runner makes one worktree per checkout on `session.create`, each in
  its own directory of the session folder (two repositories sharing a name
  take `<repo>` and `<owner>--<repo>`). The create body takes one to
  `MAX_SESSION_CHECKOUTS` (5) distinct repositories, the agent starts in
  the first unless `cwdGithubRepoId` names another. Adding one to a
  running session stays refused (`SESSIONS_010`, which keeps its code):
  the wire has no frame that adds a worktree to a live session, so the
  repositories are picked at create. A session with none
  is still refused (2026-09-27).
- 2026-10-26: **every section opens a bot's chat in place** (`design/bots/bots-in-sections.md`): Sessions, Automations and Plan too, under their own address and sidebar, not Employees as their frames link it.
- 2026-10-28: **the work folder's checkouts live in `.noindex` directories**
  (`design/sessions/session-places.md` §2): `repos.noindex/` and `sessions.noindex/`, layout version 3.
  2026-10-01's hidden `.worktrees/` was lost when sessions moved to the
  work folder, leaving only `.metadata_never_index`, which that entry had
  measured as not working; Spotlight skips a directory named `*.noindex`
  and everything under it. No migration: a session keeps the folder its
  state records, and a store left in `repos/` is cloned again on its next
  create.
- 2026-10-31: **the relay's critical path hardened** (`design/foundations/protocol.md`, `design/foundations/control-plane.md`, #556): a hello
  whose reconciliation fails closes the link with 1013 for a redial and a
  fresh hello, instead of being logged; the handshake answers 503, not 401, when
  the assertion's store is down; attach sockets are pinged like the link;
  a browser's `resize` and `credit` are held to a rate per attachment and a
  credit clamped; a lost pane's `session.stopped` is keyed by run and link
  epoch and written only while the row is still open and not stopped. The
  single API replica is written down as a known constraint (`design/foundations/control-plane.md`, open
  question 4).
- 2026-10-31: **the host proves itself on every direct channel** (`design/runner/peer-to-peer-and-the-host-proof.md`, `design/runner/direct-terminal-path.md`,
  `design/foundations/protocol.md`, `design/foundations/security-checklist.md` F30). Asked for: "as much p2p as possible … some handshake to make
  it more robust". `design/runner/direct-terminal-path.md` bound the data channel to the DTLS fingerprints in the
  signalling, which the control plane carries, so a compromised one could
  splice two DTLS sessions. Built: before a byte crosses a channel the host
  signs both fingerprints and the browser's nonce with its pairing key; the
  browser checks the signature against its own peer connection, pins the key
  per host on first use and refuses another; the runner moves output to the
  channel only on the browser's `ready`. The relay invites only a runner
  naming `attachment.direct.proof`, and names the host in `attached.direct`.
  `design/runner/peer-to-peer-and-the-host-proof.md` also orders what moves off the control plane next.
- 2026-10-31: **the host pin does not stop an active control plane that
  invents host ids** (`design/runner/peer-to-peer-and-the-host-proof.md`, corrected the same day after the pull request's
  security review). The pin is keyed by the host id the relay names, and an
  unseen id is first use, so a compromised control plane can name a fresh one
  and sit in the middle with a key of its own. `design/runner/peer-to-peer-and-the-host-proof.md` now says so, and its open
  question 4 asks how first use stops being automatic.
- 2026-11-04: **the runner is an app bundle on macOS** (`design/runner/runner-install-and-update.md` §2, §5; `design/runner/runner.md` open
  question 4). The bare binary with an ad-hoc signature, a new file per
  version, was a new program to macOS on every update, so every Mac asked
  for its permissions again. The macOS archive now carries
  `OppenheimerRunner.app`, signed with a Developer ID and notarized in CI,
  and the bundle that runs lives at one path an update swaps atomically.
- 2026-11-09: **Done keeps the past week** (`design/plan/plan-product.md` §2, its open question 2).
  Plan's Done column shows the tasks finished since local midnight seven
  days ago and folds the older ones under "Show *n* older" at its foot,
  Linear's "past week" display option. Nothing is archived: the header
  counts every done task, and archiving stays a later step.

## The roadmap

- 2026-09-26: directory created with the order 0.2 Git/GitHub, 0.3
  Kanban, 0.4 Slack, 0.5 Mobile, 0.6 MCP/CLI/agent, 0.7 terminal and
  chat display.
- 2026-09-26: multi-account added, version not yet set.
- 2026-09-27: 0.2 gains a second document, the Pull requests area:
  a rail item with a rule-based queue (whose turn it is), saved views
  and analytics, algorithmic first with any agent help later.
- 2026-09-27: the owner set the Pull requests area's first cut to the
  simplest version: a PR list like Codex's plus a keyboard triage that
  always opens the next PR to review. Sections, views and analytics
  stay the direction, after it.
- 2026-09-27: PR classification (type, risk and effort, priority, area)
  is rules first, with TypeSafe's Jev only for what rules cannot read,
  gated by confidence, opt-in per workspace, and never reordering
  triage in 0.2 (`design/pull-requests/pull-requests.md` §8).
- 2026-09-28: analytics stays inside the Pull requests area for now
  (`design/pull-requests/pull-requests.md` §5); it becomes its own rail item, with PRs as
  one tab, once it covers sessions, agents, hosts or automations.
- 2026-10-05: version 1 of the Pull requests area is the queue with a
  summary on every PR, plus Analytics; lanes, auto-merge and prepared
  review sessions come after. Design handoff:
  `design/pull-requests/pull-requests-design-handoff.md`.
- 2026-10-05: the 2026-10-05 evening frames (`PullRequests.dc.html`) are
  the spec for the Pull requests area's first version, over the notes;
  the API plan is `design/pull-requests/pull-requests-api-plan.md`.
- 2026-10-14: voice added, version not yet set: dictation into the
  composers and the terminal, and a spoken session setup that fills the
  new-session form (never starts it on its own).
- 2026-10-14: voice has one mic, the composer's, which always dictates.
  Setting up a session from what was said is the sessions module's
  `POST /v1/sessions/proposals`, which takes any text, so the voice
  endpoint stays audio in and text out.
- 2026-10-16: voice transcribes on the workspace's ChatGPT sign-in
  (Settings → Model providers), through ChatGPT's dictation route, with
  an OpenAI-compatible key as the fallback. The route is undocumented;
  if it only answers clients posing as the Codex app, the fallback
  takes over.
- 2026-10-17: voice slice 1 built: dictation into New session's composer.
  The console records WAV itself, the route asks `sessions:write`, and the
  recorder stays in the sessions feature until a second surface needs it
  (`design/console/voice.md`, "Slice 1 as built").
- 2026-10-17: voice's providers are one `SpeechProvider` interface and an
  ordered list; the console reads `GET /v1/voice/status` instead of
  deciding availability itself (`design/console/voice.md`).
- 2026-10-22: channels added, version not yet set: a bot reachable on
  WhatsApp (a linked device of a number the owner has, as OpenClaw does
  it), Slack and email, each channel one implementation of one interface,
  libraries for the transports, no hosted bridge. 0.4 Slack becomes its
  Slack channel (`design/channels/channels.md`).
- 2026-10-22, in review: the WhatsApp socket is held by the runner on the
  owner's host, so its keys never leave it and the API holds no long-lived
  connection; email is polled. 0.4 now covers only sessions in Slack.
- 2026-10-22: cloud agents added, version not yet set: a Cloud place for
  sessions in Claude's, Codex's and Cursor's clouds, Cursor through its
  API, Claude and Codex through the runner on a host (`research/cloud-agents.md`).
- 2026-10-24: customers and routes added after channels.
- 2026-10-29: channels start with email, an address of the bot's own.
- 2026-10-29: mail added ahead of channels: bots work your own Gmail, drafts included, every send approved.
- 2026-10-26: Cursor's cloud agents landed ahead of a version, as a rail
  item of their own on the person's Cursor key ([Cloud agents](design/sessions/cloud-agents.md),
  "What landed"); Claude and Codex cloud keep their place in its order.
- 2026-10-27: Claude cloud built ahead of Cursor, at the owner's request: a
  `cloud` place started by the host's runner with `claude --cloud`, and its
  status reported by `apps/extension` from claude.ai (`design/sessions/cloud-agents.md`,
  `design/sessions/session-places.md` §7).
- 2026-10-28: both clouds kept, at the owner's request: Claude Code's
  (started by a host) and Cursor's (launched by the control plane, no host)
  are two kinds of the one `cloud` place; Grok's comes after them
  ([Cloud agents](design/sessions/cloud-agents.md), "Two kinds of cloud session").
- 2026-10-31: 0.7 gains a second document, [the chat's model and
  protocol](design/sessions/chat-protocol.md), with six slices drawn from a read of
  Codex and Grok.
- 2026-11-02: agent tools added (`design/sessions/agent-tools.md`), from the tools Claude
  Code has in its own cloud sessions: send a file, notify, wake on a pull
  request, wake later. Send a file built the same day.
- 2026-11-02: Sentry added: error reporting, and Sentry issues as a trigger
  source (`design/automations/sentry.md`); version not set.
- 2026-11-08: Telegram added (`design/channels/telegram.md`), OpenClaw's Bot API route on
  WhatsApp's gateway: a BotFather bot long-polled by the runner on a host,
  its token kept there, its chats read and answered by the owner's bots
  with WhatsApp's tools and per-chat send grant; slice 1 built the same day.
- 2026-11-09: Answering on Telegram and WhatsApp added
  (`design/channels/answering-on-telegram-and-whatsapp.md`), Telegram slice 3 and
  WhatsApp slice 4 in one design, ahead of their routine triggers, from
  OpenClaw and Hermes Agent.
- 2026-11-20: Slack for bots added (`design/channels/slack-for-bots.md`), Channels §7.2's
  Slack with one app per bot instead of one per workspace.
