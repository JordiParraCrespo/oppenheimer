# Vision

Everything discussed while planning the platform, in the order it was
decided. Read `brief.html` for the one-page version, or the notes below
for the detail and sources.

| # | Note | What it settles |
|---|------|-----------------|
| 00 | [Vision and plan](00-vision-and-plan.md) | What we build, lessons from OpenClaw and Orca, layers, domain model, stack |
| 01 | [Terminal first](01-terminal-first.md) | The core primitive is a persistent PTY in the browser; how Orca's relay does it; subscription logins done legitimately |
| 02 | [Targets and GitHub auth](02-targets-and-github-auth.md) | Direct-machine vs isolated-VM targets; proxy-injected GitHub tokens as Claude Code on the web does it |
| 03 | [Machines and VM provisioning](03-machines-and-vm-provisioning.md) | herdr, the Actions runner registration design, Actuated, the Firecracker provisioner, service split, Go runner |
| 04 | [Security review](04-security-review.md) | 28 findings by trust boundary, Tailscale as an optional perimeter, the measured reference VM spec |
| 05 | [GitHub experience](05-github-experience.md) | Connect, start, review, PR, auto-fix, routines, environments, and what each piece costs |
| 06 | [Multiple accounts](06-multi-account.md) | How Orca handles several Claude, Codex, Kimi, OpenCode accounts and usage meters; our account model; macOS resolved |
| 07 | [MVP](07-mvp.md) | A personal workspace of sessions, each a KVM guest on the Hetzner host, each just a terminal; Codex first; hosted web control plane |
| 08 | [Reuse the GHA runner host](08-reuse-gha-runner.md) | The existing Go runner controller is most of the provisioner; what sessions add; libvirt first, Firecracker later; website and runners in different places over the tailnet |
| 09 | [GitHub App install](09-github-app-install.md) | Install the App, choose all or selected repositories; the installation is the access control; narrowed one-hour tokens per session |
| 10 | [Sleep, wake, and pricing](10-sleep-wake-and-pricing.md) | Suspend and hibernate tiers on libvirt and on AWS, GCP, Azure, Fly, Hetzner Cloud; what an AX42 host holds; sleeping sessions are free; pricing shape |
| 11 | [Workspace layout](11-workspace-layout.md) | One fixed place per repo (§1 superseded by `versions/mvp/10`: one store per repo per workspace, checkouts under sessions); three runtimes: Shared workspace VM, Clean VM, This machine (the Mac Studio with simulators) |
| 15 | [Reviewing at the speed agents write](15-reviewing-at-agent-speed.md) | Review is the bottleneck: every PR in a lane (Auto, Quick, Deep); auto-merge by a readable policy, proven in a dry run on your history; a review session prepared on your host with the context pack, the checks run and a brief waiting |
| research/ | [Research](research/README.md) | Reads of other products, measurements and proposals that were not adopted; they decide nothing. Notes 12 (Grok Bot), 13 (herdr), 14 (session boot time) and 16 (developer-tools landscape) live there, and its index maps the old numbers |
| versions/mvp/ | [MVP design](versions/mvp/README.md) | In-depth design of the MVP, one document per area, with its own decision log |
| next-steps/ | [Next steps](next-steps/README.md) | The versions after the MVP, one document each; its README is the list and holds the order |

Decisions that changed along the way, so nobody is confused by an
earlier note:

- Note 00 proposed the Claude Agent SDK as the core. Note 01 replaced it
  with a raw terminal; the SDK is a later add-on for unattended runs.
- Note 00 proposed a Node runner. Note 03 changed it to a single static
  Go binary.
- Note 06 first flagged the macOS Keychain as a blocker for multiple
  Claude accounts; it then verified that Claude Code 2.1.144+ scopes the
  Keychain entry per config dir, so it is not.
- Note 07 was first written as a five-screen MVP, then cut to sessions
  only on direct machines, then, after seeing the console mockups,
  reset to sessions in VMs with repo, branch, and agent chosen at
  creation. The session view stays a terminal; the Agent SDK stays out.
- Note 04 first proposed one persistent home volume per target. After a
  review found that conflicted with running two accounts concurrently,
  notes 04, 06, and 07 now use one volume per account.
- Note 07 records the VM lifetime decision: pause while idle, resume on
  visit, destroy on close. The phase table in note 00 is superseded by
  the order of work in note 07.
- Note 07 chose Firecracker first. Note 08 replaced it with libvirt/KVM
  because an existing, hardened controller already runs that on the
  target host. Firecracker is now a later cold-start optimization.
- Notes 02 and 05 described Claude Code on the web's access model, where
  the user's OAuth grant reaches any repository the account can see and
  the App only adds webhooks. Note 09 chooses the stricter model: the
  App installation, with all or selected repositories, is the access
  control.
- Note 07's single "pause when idle" became note 10's three tiers,
  tuned to the real host (i7-6700, 64 GB, SATA SSD): pause in RAM after
  ten minutes, suspend to disk after two hours, hibernate after a day.
- Note 07 said a VM per session. Note 11 keeps that for Ephemeral
  sessions and makes Keep sessions worktrees inside one workspace VM per
  repo per host, so the worktree UX matches Orca and ten sessions on a
  repo share one clone, one setup, and one Docker daemon.
- Note 00 proposed Next.js for the web app. Note 07 §11 leaves the
  framework open with a recommendation for a Vite + React SPA; Next.js
  used as a client app is also fine. The firm point is only that the
  console is a real-time client, not a server-rendered site.
- Note 07's VM-based MVP is superseded by `versions/mvp/00-scope.md`: the MVP
  is Orca on the web without VMs, sessions directly on your own hosts,
  Claude Code first. The VM design is the slice after, not deleted.
- Sign-in was GitHub-only; it is now GitHub, Google, and email plus
  password on day one, with Connect GitHub as a separate step
  (`versions/mvp/00-scope.md`).
- Notes 00 and 07 and `versions/mvp/03-control-plane.md` said Hono plus
  Drizzle for the control plane. The code started from the Flama
  starter, so the control plane is NestJS plus TypeORM on Postgres, with
  Better Auth for identity. The modules and the data model are unchanged;
  only the framework is (`versions/mvp/03-control-plane.md`).
- The codebase keeps every app the starter ships (admin, mobile, CLI,
  MCP, showcases, Helm) from day one, so later slices need no porting.
  Only `api`, `web`, `runner`, `docs` and `e2e` are the MVP; the rest is
  carried, not built on, until its slice arrives (`AGENTS.md`).
- The personal workspace is a row in the starter's `organization` table
  with the account as its single owner member, created at sign-up. No
  roster, no invitations, no teams are exposed in the MVP
  (`versions/mvp/08-auth.md`).
- Signed self-update moved from `versions/mvp/00-scope.md`'s out-list
  into the MVP. What changed is *when*, not what: F26 always said signed
  updates the control plane cannot forge. Design in
  `versions/mvp/09-runner-install-and-update.md`; F26 is now on the 07
  checklist.
- Note 03 cited herdr from its website. Note 13 reads its source: the
  architecture matches ours, but herdr owns the PTYs, so its agents do not
  survive a restart. Our tmux layer is what buys that, at the cost of
  terminal fidelity — recorded as a trade, not a win.
- `versions/mvp/00-scope.md` and `05-screens.md` said onboarding was four
  screens ending on New session and a session was one repository. The
  version-1 frames, walked with the owner on 2026-09-19, changed both:
  onboarding names the workspace and lands on a Ready summary, and a
  session may span several repositories, one worktree each. Recorded in
  00, 05, 08 and the MVP decision log.
- `versions/mvp/00-scope.md` and `05-screens.md` said, from 2026-09-19, that a
  session may span several repositories. The runner makes one worktree per
  session, and a two-repository session was accepted, refused by the host and
  left spinning (#56); on 2026-09-23 the owner set the MVP to one repository
  per session. The model keeps checkouts as a list with a primary, so several
  repositories returns with the runner slice that makes several worktrees.
  Recorded in 00, 05, 10 and the MVP decision log.
- `versions/mvp/10-api-modules-and-data-model.md` said a session has zero or
  more checkouts, zero being a session with no git. The runner makes a
  session from exactly one repository, so a session with none was recorded,
  then failed on the host. On 2026-09-27 the owner set the create body to
  exactly one checkout, and the console's composer stays disabled until a
  repository is picked. Recorded in 00, 10 and the MVP decision log.
- `versions/mvp/08-auth.md` said first-run's gate is the claimed address
  off step 2. That still ends step 2, and it cannot end the flow: two
  steps run after the claim, so every legitimate arrival at the Ready
  landing is finished too. The landing asks instead whether the
  navigation *is* the walk, and `/onboarding/ready` reached any other way
  — Back out of the console, a typed address — returns the reader to the
  console, and Add host asks the same, now that the console pairs a
  machine in its own dialog rather than sending readers into step 4.
  Connect GitHub is not gated, because New session's repository chip
  still sends a finished account there to install the App
  (`versions/mvp/05-screens.md`).
- Note 02's open question about screen manifests is answered by note 13:
  lifecycle hooks are authoritative where an agent has them, screen reading
  is the fallback, and rules carry a priority and negative guards rather than
  being a chain of ifs (`versions/mvp/02-runner.md` §9).
- The control-plane modules and data model *have* now changed, where the
  line above said only the framework had. `versions/mvp/10-api-modules-and-data-model.md`
  replaces note 03's seven modules and its first-cut table list with
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
- Note 11 said one worktree per session under
  `workspaces/<repo>/main`. `versions/mvp/10-api-modules-and-data-model.md`
  supersedes its §1: a session may check out **several** repositories,
  those checkouts live under the session rather than under the repo, and
  one bare store per repository serves the workspace. The store is a
  bare clone, always owner-prefixed, and every directory name is a
  database constraint instead of a convention. A **project** level above
  the repository was in 10's first draft and was taken out on
  2026-09-26, when a project became a saved scope a person creates and
  metadata only, so a session can move between projects without anything
  on disk moving. Note 11 §2 onward still stands.
- `versions/mvp/08-auth.md` said hosts belong to the workspace that
  paired them, then to a workspace and an owner. `versions/mvp/10` now
  makes a host the person's, borrowed by every workspace they are in,
  the way Better Auth hangs devices and logins off `user`; the on-disk
  layout gains a `workspaces/<org>/` level. Note 06's
  per-account config directories remain the answer to several logins on
  one machine, and remain a later slice.
- `versions/mvp/10` first mirrored every installation's repository set
  with webhooks and a resync. It now lists repositories live from GitHub
  and keeps a row only for repositories a session has checked out. Note
  09's "the installation is the access control" is unchanged; what
  changed is that we stopped keeping a copy of the list it controls.
- The same note then dropped the repository table entirely: a checkout
  carries GitHub's ids inline and the runner owns the store on disk.
  Seven new tables, not eight.
- `versions/mvp/05-screens.md` described a settings drawer holding
  hosts, and the console kept the starter's Settings and Profile pages
  underneath it. The version-1 frames of 2026-09-21 drew neither, so the
  console became one screen — sidebar plus pane — and both pages were
  deleted rather than hidden, with the drawer as the later answer for
  hosts. The 2026-09-26 export then drew Settings as a page of its own
  beside the console — `/settings`, opened from the account menu, with
  Profile and Hosts as its sections and the console's pairing page behind
  Add host — and 05 records that page; the drawer is gone (2026-09-26).
- `versions/mvp/10-api-modules-and-data-model.md` said a model was a
  launch option "recorded in the log, not a column", and made the
  promotion conditional on a reader needing it per row. `restart` is that
  reader, so the note now records the promotion as decided: the three
  launch options the composer's foot row sets are folded onto
  `work_session`, which is a projection of the log and so was a replay
  rather than a backfill. "No table, no endpoint" is unchanged, and the
  flag strings each permission level maps to are catalog data beside
  `command`, not a column per agent. The surface itself is in the notes
  that own it — `versions/mvp/03-control-plane.md` for the route and the
  fold, `01-protocol.md` for the wire.
- The coding-agent catalog seeded Claude Code with the aliases its CLI
  documents (`opus`, `sonnet`, `fable`) and gave Codex no models at all,
  on the argument that a pinned id is a list this repository has to keep
  current. Both halves changed: the seed is now one row per model each
  CLI documents, keyed by the model's full name, because the engine
  button shows a person a *generation* and an alias that moves under a
  versioned label is a pair that goes out of step on the host with
  nothing on screen saying so. `versions/mvp/05-screens.md` keeps "the
  model list is the harness's own" and holds no roster; the list lives
  in `CODING_AGENTS`. The probe (05, open question 6) is still open, and
  pinning raises what it is worth.
- `versions/mvp/01-protocol.md` said the epoch was "a counter bumped on
  every successful connect". The in-process counter restarted at 1 with
  the API. The runner refuses an epoch that is not newer than its last,
  so after a deploy a host needed dozens of redials to get back on. The
  epoch's floor is now the control plane's clock in milliseconds. The
  same note now also says that PTY bytes are never dropped, how the
  runner's writer orders frames, and that liveness is ping/pong.
- `versions/mvp/00-scope.md` now lists five catalog agents; Grok is the
  fifth (2026-09-25).
- `versions/mvp/05-screens.md`: the repository chip's foot row was
  "Connect a repository…", back to the onboarding step. It is now
  "Manage repository access", a new-tab link to the GitHub App's
  installation page (2026-09-26).
- `versions/mvp/10-api-modules-and-data-model.md` said the MVP never shows
  a project chip. The 2026-09-26 export puts one first on New session, with
  a New project page behind it; 05 and 10 now carry the chip, the page and
  the model (2026-09-26). The chip starts on the workspace's Unassigned
  project, where a session that names none is listed.
- `versions/mvp/05-screens.md`: the project dialog and the Add host dialog
  are pages over the main column (`/projects/new`, `/projects/{id}`,
  `/hosts/new`) since the 2026-09-26 evening export, and the second rail
  item reads Automations. A project needs a repository to be saved from the
  console (2026-09-26).
- `versions/mvp/05-screens.md` and `13-automations.md`: those pages went
  back to dialogs over the console with the 2026-09-27 export — New
  project and Project settings, the console's Add a host, the automation
  editor as a three-step wizard — while Settings keeps its Add a host
  page. Add a host copies first and shows the instruction behind a fold,
  in the console and in onboarding (2026-09-27).
- `versions/mvp/00-scope.md` kept routines out of the MVP whole. The
  console's automations list and its pages have their routes now, so the
  rail is whole; the automation itself — scheduler, trigger, runs — stays
  after (`versions/mvp/13-automations.md`, 2026-09-26).
- The order after the MVP was VMs with sleep tiers, the accounts model,
  then note 05's GitHub pieces (`brief.html`, `versions/mvp/00-scope.md`).
  On 2026-09-26 the owner set a new order: 0.2 Git/GitHub, 0.3 Kanban,
  0.4 Slack, 0.5 Mobile, 0.6 MCP/CLI/agent, 0.7 terminal and chat
  display. Multi-account (note 06) is on the list with no version yet.
  VMs are not placed. See `next-steps/README.md`.
- `versions/mvp/05-screens.md` said version 1 has no settings page and
  that hosts would be listed later in a drawer. The 2026-09-26 frames
  draw a Settings page with a Hosts section, and
  `versions/mvp/14-hosts-settings.md` designs its backend. Two host
  behaviours changed with it: removing a host now stops the sessions
  running on it (it used to close the link and leave them `open`), and
  `GET /hosts` leaves unpaired hosts out unless `include=unpaired`
  (2026-09-26).
- `versions/mvp/10-api-modules-and-data-model.md` kept a host's
  metadata on the `host` row: `hostname`, `os`, `arch`, `runnerVersion`,
  a `capabilities` jsonb and `lastSeenAt`, rewritten whole on every
  heartbeat. `versions/mvp/15-host-metadata.md` splits it by rate of
  change into `host_inventory`, `host_presence`, `host_network` and
  `host_event`; the old columns go in a later contract step (2026-09-26).
- `versions/mvp/05-screens.md` had Settings → Hosts open the console's
  Add a host page with `?from=settings`. It now opens the same screen
  inside Settings, at `/settings/hosts/new`, with the settings sidebar
  beside it, and the host menu drops Copy host ID for now (2026-09-26).
- `versions/mvp/14-hosts-settings.md` left the host card's region or
  "local" open. It shows the city and country code of the host's
  connecting address, from DB-IP Lite, instead of a cloud region
  (2026-09-26).
- `versions/mvp/00-scope.md` kept automations out of the MVP, and
  `versions/mvp/13-automations.md` built only their console routes. They
  are in the MVP now, designed in `versions/mvp/16-automations-architecture.md`:
  headless runs for any agent, an inbound-events hub for GitHub and later
  Slack, schedules fired by a tick, a run acting as its owner. Note 05 §7's
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
- 05 put Project settings behind a cog. The version-1 export's settings
  glyph is two sliders, so both Settings controls in the console draw
  that, and 05 keeps one glyph per meaning (2026-09-28).
- 03 checked an attach ticket at redemption only. An open attachment is now
  judged again every minute (session state, membership, account standing,
  host access), and minting a ticket or restarting a session checks the
  host too, so a revoked grant ends a terminal already streaming
  (2026-09-28).
- 16 §Q6 de-duplicated deliveries by `(source, deliveryId)` alone. The
  delivery id is an unsigned header, so the raw body's SHA-256 is unique
  per source too, and GitHub `installation` events apply in the order of
  GitHub's own timestamp rather than receipt (2026-09-28).
- A host's credential ignored its owner's standing. A banned or deactivated
  owner's runner is now refused at the link handshake and closed by a heartbeat
  within a minute, and a session's git token is not minted for a creator who may
  not act (2026-09-28).
- 15's retention periods, the pairing token's lifetime and cap (00, 09) and
  the API's default and auth-failure rate limits were fixed in code. They are
  now deploy-tunable through the root `.env` (`RETENTION_*`, `HOSTS_*`,
  `RATE_LIMIT_*`), with the product's numbers as the defaults (2026-09-29).
- 05's composer drew a paperclip wired to nothing; it now attaches images
  to the first task (03) (2026-09-28).
- `versions/mvp/02-runner.md` had the runner build a session's tmux session
  last, after the stores and the worktree, and `session.started` therefore
  meant "the agent is up". Every second of the clone was then a spinner, and
  the console's attach either waited for the whole create or was refused. On
  2026-10-01 the terminal became the first stage: `session.started` means the
  session has a pane, an attach is served while the create is still running,
  and the worktree moved into a hidden directory so Spotlight stops indexing
  it while the agent boots. Recorded in 01, 02, 05 and the MVP decision log.


- `versions/mvp/02-runner.md` had a store's first clone be blobless
  (`--filter=blob:none`) and the whole of a create's network work happen
  after Send. On 2026-10-02 the first clone became shallow at the base and
  deepened in the background into the same blobless store, and New session
  started sending `repository.prepare` when a host and a repository are
  picked, so the clone and the spare worktree are made while the prompt is
  written (02 §5, 01, 05; measured in 14).
- 03, 01 and 05 let a session take images only; on 2026-10-04 it takes files
  (images, PDF, text) judged by their bytes, and a runner that does not
  announce `session.files` is still sent images only (01, 02, 03, 05, 07).
- `next-steps/` placed a kanban board in 0.3. On 2026-10-05 the design
  export drew it as Plan (tasks, goals, a calendar) and the owner put it
  in the MVP (`versions/mvp/17-plan.md`); 0.2 with pull requests is next.
- 17 and 19 put Plan behind a `plan` release flag, with a task summary
  endpoint, a `'task'` session origin and an automation occurrences
  endpoint. The first version shipped with none of them: no flag, the
  board's one read serves every count, a task's session is a person's and
  its link records the task, and the console computes automation runs
  (`versions/mvp/17-plan.md`, "As built").
- 17 to 19 named Plan's grouping of tasks **goals**. The 2026-10-13
  export renamed them milestones, and the owner had the rename go all the
  way down, tables and routes included (`versions/mvp/23-plan-milestones-stats-accounts.md`).
- Note 23 first gave Plan's console a Stats view, a project overview, a
  project list in the sidebar, a Blocked row on tasks and a toggle per
  Google account. The owner had the console match the 2026-10-13 `Tasks`
  frame instead (2026-10-13): Tasks, Milestones (the timeline alone) and
  Calendar, nothing more. The API pieces stay for the agents' Projects
  section (`versions/mvp/23-plan-milestones-stats-accounts.md`, "Settled since").
- Note 20 had a Google event open read-only with only "Open in Google
  Calendar". Since 2026-10-20 a Google event that is a video meeting
  (Meet, or Zoom, Teams or Webex through an add-on or a link pasted
  in the location or description) also offers
  Join meeting from the calendar; the layer is still read-only
  (`versions/mvp/20-plan-calendar.md` §1, §5).
- Note 15's first version proposed protecting the reviewer and the
  evening: a WIP limit on agent PRs, quiet hours, overnight holds. The
  owner rejected it the same day (2026-09-27): the product is for people
  who push hard. Note 15 now goes after the review bottleneck instead,
  with lanes, auto-merge for easy PRs, and a review session prepared
  with the context.
- Note 15 then settled its own questions with the owner (2026-09-27):
  Jev picks the lane, and each lane has an agent (verification, summary,
  full review); review is an automation with the agent picked in its
  Agent step; auto-merge covers every PR that passes. The same day it
  said the Oppenheimer App would approve as its own reviewer; on
  2026-09-28 the owner changed that: we approve and merge in the user's
  name, with their own authorization, and when GitHub will not allow it
  the PR waits.
- `globals.css` made the console's ground white. Since 2026-10-06 it is
  the export's grey under every page, and the shell, not the screen, draws
  each page at the route's measure (`versions/mvp/README.md`).
- `versions/mvp/05-screens.md` had the console learn of every change it
  does not cause by polling. On 2026-10-06 a workspace event stream was
  added, behind the `workspace_event_stream` flag, and the polls it covers
  stand down while it is live and poll again when it drops
  (`versions/mvp/03-control-plane.md`, 05). Issue #239 asked which version
  it belongs to: the MVP, since the polls it speeds up are the MVP's own.
- `next-steps/0.2-pull-requests.md` had the queue read every repository
  the installation reaches, so your pull requests and the reviews asked
  of you came from anywhere while Watching stayed opt-in. It now reads
  what the reader watches and nothing wider; the wider reach returns as
  one search rather than a listing per repository. That note holds the
  rule and what the reach cost (issue #247).
- `versions/mvp/08-auth.md` had a terminal open only to a member of the
  session's workspace. Since 2026-10-08 a member can share one with a
  link, to watch or to type, for anyone, any account or named people
  (`versions/mvp/21-session-share-links.md`). The link's ticket is judged
  as its creator's, so it opens nothing they could not.
- `versions/mvp/21-session-share-links.md` built sharing on 2026-10-08 as
  bearer links (anyone signed out, any account, or named people; the
  secret shown once). On 2026-10-13 it was rebuilt to the `ShareSession`
  design: one share per session at one address, named people or anyone
  signed in, write for named people for a day at most. The note keeps the
  links under Superseded.
- Note 06 described Orca as a viewer over files the vendor CLI owns.
  Its source shows that holds for the default login only: for a managed
  account Orca captures, stores and refreshes the token itself. Note 06
  says so in a correction under that paragraph, and its rule that the
  platform never reads the credential file is now a deliberate
  difference from Orca (`research/orca-web-auth-and-cross-host-logins.md`).
- `next-steps/0.2-pull-requests.md` §6 said a repository the App is not
  installed on does not appear in the queue. On 2026-10-08 the owner
  pointed at organisations where it never will be: such a repository's
  PRs now fill the same queue row by a search on the person's own
  token, opt-in and kept encrypted in the control plane, with their
  notifications as the wake-up; private repositories take a second,
  read-only token (§6.1). The App stays the main path; sessions and note
  09 are unchanged (#271).
- `versions/mvp/01-protocol.md` said the browser never reaches the runner
  directly, every byte going through the relay. On 2026-10-11 the owner
  made the session's latency the priority: `versions/mvp/22-direct-terminal-path.md`
  adds a WebRTC data channel from browser to runner, started after the
  relay path and falling back to it (built the same day, behind the
  `terminal_direct_path` flag), and the console now draws predictable keys
  before their echo. The relay still admits every attachment.
- `versions/mvp/05-screens.md` said a deleted session's row stays until
  the host confirms the close. On 2026-10-11 the owner asked for delete
  to feel immediate: the row leaves on the click and comes back only if
  the close cannot happen. A session removed on its host (by hand, or by
  `runner sessions close`) now closes on Delete or Restart instead of
  being stuck for ever.
- `versions/mvp/05-screens.md` said selecting text needs Shift-drag
  (Option-drag on macOS), because tmux owns plain drags. On 2026-10-11
  the owner could not copy a plain-drag highlight: tmux copied it to its
  own buffer and the console dropped the OSC 52 that carried it out. tmux
  now runs with `set-clipboard on` and the console writes OSC 52 to the
  clipboard (writes only, never reads), so a plain drag copies on release.
- `versions/mvp/05-screens.md` had onboarding's Add a host step and the
  console's Add a host dialog lead with Copy install command and Copy
  agent prompt, the instruction behind an Inspect fold and one status
  line. Since 2026-10-13 both lead with the agent prompt (Copy prompt, the
  text behind a fold), fold the command behind "Install manually instead"
  and show a Connection list: Runner installed, then Host connected. The
  export's Tools on PATH row waits for the wire to carry a host's tools.
  Settings' Add a host page keeps the panel with both forms.
- `next-steps/0.2-pull-requests.md` (version 1 scope, 2026-10-05) put a
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
  (`next-steps/0.2-pull-requests.md`, "The screens as built").
  On 2026-10-14 the review session came back without the review agent:
  a pull request's **Chat** tab starts Claude Code on one of the reader's
  hosts, in a worktree of the head branch, on a prompt that opens with a
  two-or-three-line take and waits, and then shows its terminal with an
  input line under it; review sessions are listed under **For review** in
  the Pull requests sidebar and never under Sessions. That is §4's *Check
  out in a session* decided as 0.2.
- `versions/mvp/10-api-modules-and-data-model.md` held a project to at
  least one repository, and the console would not save one without (the
  2026-09-26 line above). On 2026-10-14 the owner allowed a project with
  no repository: it is a place for tasks, milestones, memory and sessions,
  and folder and terminal sessions need none. A project that holds
  repositories still offers a default among them (`PROJECTS_006`). The
  Unassigned project keeps that name.
- `versions/mvp/05-screens.md` opened New session on the `full`
  permission level every visit and never remembered it. On 2026-10-14 the
  owner made it open on `auto` and remember the last level picked, like
  the other chips.
- `versions/mvp/05-screens.md` never remembered New session's repository
  and branch, and let the landing project's default host, agent and
  repository replace the last visit's choices. On 2026-10-22 the owner made
  every chip open on its last choice: the scope is remembered, and the
  landing project fills only the chips the memory left empty. Picking a
  project on the screen, or naming one in the address, still applies all
  its defaults.
- `versions/mvp/00-scope.md` made every session a worktree, the blank
  terminal included, under `~/oppenheimer-ai/workspaces/<repo>/`. On
  2026-10-14 the owner made the place a choice, a new worktree or a folder
  already on the host, and moved the runner's work to `~/oppenheimer/`
  as `<account>/<workspace>/{repos, agents, sessions}`
  (`versions/mvp/24-session-places.md`). The same day the account level's
  name was settled as the id the runner receives when it is paired
  (`POST /hosts/register` answers it), so `session.create` and
  `repository.prepare` carry the workspace only (24 §2, §5).
- The agent catalog mapped Claude Code's `auto` level to
  `--permission-mode acceptEdits`, which prompts on every shell command,
  and review sessions launched at `ask` (both left open in
  `versions/mvp/16-automations-architecture.md` and
  `research/headless-runs-draft.md`). On 2026-10-15 the owner made `auto`
  Claude Code's own auto mode (`--permission-mode auto`), which checks each
  action before it runs, and made it the level review sessions start at.
- On 2026-10-16 the owner dropped the review session's input row, which
  doubled the agent's own prompt; the Chat tab is now the plain session
  pane (`next-steps/0.2-pull-requests.md`).
- `versions/mvp/25-bots.md` ran a bot as a headless turn on its home host;
  on 2026-10-15 its loop moved into Oppenheimer (25, "Decided").
- Note 25 let a bot keep Claude Code's `WebFetch` and subagents. On
  2026-10-15 both were turned off: the fetch reached the server's private
  network, and subagents searched the server's disk (25, "Decided").
- Note 25's system prompt was the bot's soul, instructions and memory. On
  2026-10-15 it became ours from the first line, with a closed list of
  what the bot can do and the sender's time, home host and hosts, and a
  turn stops after 4 minutes (25, "Decided").
- Note 25 ran bots on three providers, each on a workspace's API key. On
  2026-10-15 ChatGPT became a fourth, signed in with a ChatGPT subscription
  through OpenAI's device code flow, the way OpenClaw and the Codex CLI do
  (25, §2 and "Decided").
- Note 25's system prompt ended with the moment the turn ran in: the
  sender's time, the home host and the hosts. On 2026-10-15 that moved to
  a `<turn_context>` block opening each turn's message, so the system
  prompt is the same bytes every turn and the provider's prompt cache
  hits (25, "Decided").
- Note 25 sent a turn the bot's last 40 messages and dropped everything
  older without a word. On 2026-10-15 history became a token budget
  (24,000 tokens) opened by a stored summary of the older messages, which
  a `bot-summaries` job writes with the bot's own model once they pass the
  budget with headroom (25 §2, "Decided"). The chat still shows every
  message.
- Note 25 named a bot's last settings page Runs on (Works on from slice
  3), and its picks, the colour and sidebar group on Profile included,
  saved on the click. On 2026-10-16 the owner, testing it, read Runs on as
  where the bot runs: the page is **Home host** now, says the bot always
  runs in Oppenheimer and the home host is only where its sessions start
  when no machine is named, offers No home host, and every bot settings
  page saves a draft with Save (25 §1, "Decided").
- Note 25 named a blank bot "New Bot" and had it ask for its job in one
  line. On 2026-10-16 a blank bot takes the next of twenty first names
  ("Juno", "Milo"…), and its first chat walks it through learning one
  job, writing its own INSTRUCTIONS.md and description, and offering a
  first task (25 §1, "Decided"; `research/lessons-from-grok-bot.md` §6).
- `versions/mvp/23-plan-milestones-stats-accounts.md` ran a project's
  milestone bar on to ten days past its last milestone, which read as the
  bar overshooting the dates. On 2026-10-15 the owner had it end on the last
  milestone's day, as a timeline bar does in Notion; the three-week lead-in
  before the first milestone or today stays (23 §1).
- `versions/mvp/02-runner.md` §10 said an agent CLI that is not installed is
  left alone and that OpenCode is never updated, because its updater asks.
  On 2026-10-12 the runner learned to install agent CLIs and `gh` when the
  person asks (`runner agents install`, `runner tools install gh`), user-level
  and without sudo, from install entries in the catalog; and OpenCode joins
  the hourly updates, told its install method so it does not ask. `git` and
  `tmux` stay with the package manager. The host installer now asks which
  agent CLIs to install, defaulting to Claude Code and gh, so the Add host
  command leaves a host ready to run a session (`versions/mvp/09` §2).
  Developing Oppenheimer itself on a new machine is one command,
  `scripts/dev/bootstrap.sh`, with `mise.toml` pinning the toolchain.
- `versions/mvp/02-runner.md` §10 (2026-10-12) installed Claude Code and
  OpenCode by running their vendors' install scripts, fetched to a file
  first but checked by nothing. On 2026-10-17 Claude Code installs from its
  latest release binary instead, verified against the SHA-256 in that
  release's manifest before the binary runs its own `claude install`, and
  `gh` shares the same check; no Claude Code script runs. OpenCode keeps
  its script for now, because its releases publish no checksum for the CLI
  (02 open question 11).
- `next-steps/voice.md` planned slice 3 as the task dialog, the terminal
  paste, a hotkey and a dictionary, and said the recorder's `AudioWorklet`
  would come when it moved to the kit. On 2026-10-17 the owner asked for
  dictation in every prose input as one shared piece: the fields shipped
  first (the kit's `dictation` concern), the rest stays for later, and the
  recorder kept `ScriptProcessorNode` ("Dictate everywhere as built").
- `next-steps/voice.md` said the polish is skipped when the raw transcript
  is clean and short, and that the ChatGPT route's names reach it only
  through the polish. On 2026-10-18 (#393) every clip is polished, with a
  light-touch brief modelled on Wispr Flow, and the names also go to an
  OpenAI-compatible speech server as its `prompt` ("Dictation quality,
  first pass").
- `next-steps/voice.md` shipped `voice_dictation` as a release flag,
  default off. On 2026-10-18 it became an `ops` flag defaulting to `true`,
  the feature's kill switch.
- Note 09 had `runner uninstall` exit 0 when the control plane could not
  be told, with a hint naming `DELETE /v1/hosts/{id}` and no console
  control. On 2026-10-18, after an owner's uninstall hid a failed
  revocation (issue #394), it exits 7 (`PAIR_009`), prints the underlying
  failure, and points at Settings → Hosts → Remove or
  `DELETE /api/v1/hosts/{id}`; `register` on a paired host names both
  origins and the commands that move it (09 §4).
- `versions/mvp/14-hosts-settings.md` had removing a host only stop its
  sessions, every checkout kept. On 2026-10-18 the owner, testing on a
  host, asked for a way to stop everything and start again: the remove
  dialog has an "Also delete everything on this machine" box, and an
  online host then closes every session, worktrees removed and nothing
  pushed (14, "Remove can also clean the machine up").
- Note 03's hello reconciliation sent again only a launch the host never
  carried out, so a close lost with a dropped link was never re-sent and a
  deleted session came back in the console. On 2026-10-18 the fold keeps a
  close owed (and the host's refusal of it) as columns, the hello sends an
  owed close again, a restart request supersedes it, and the console draws
  such a row as deleting or refused instead of bringing it back as it was
  (03, "A close is owed until the host answers it"; 01, "Hello").
- `versions/mvp/25-bots.md`: a bot with no provider named, or on one with
  no key, fell back to the first keyed provider in catalog order, so a
  workspace with GLM and ChatGPT opened its bots on GLM. On 2026-10-18 the
  owner asked for ChatGPT instead: the fallback order is Anthropic,
  ChatGPT, OpenAI, GLM (`BOT_PROVIDER_PREFERENCE`).
- Note 25 had `ask_bot` give another bot a task and wait for its answer.
  On 2026-10-18 it was built so the answer comes back as a new turn of the
  asker instead: one turn per bot runs at a time and a turn has four
  minutes, so an ask that waited could time out or leave two bots waiting
  on each other. The sender is recorded rather than claimed, messages
  holding a credential are refused, and the chain is decided under a lock,
  from `research/agent-coordination-experiments.md` (25 §4.6, "Decided").
- `versions/mvp/02-runner.md` §10 (2026-10-17) kept OpenCode on
  `opencode.ai/install`, which checks nothing, and its hourly update on
  `upgrade --method curl`, which reruns that script. On 2026-10-18 the
  owner, answering the review's "verify downloaded vendor installers",
  moved it to its npm package `opencode-ai` under `~/.local`, checked
  against the registry's integrity hash as Codex and Grok are, so no agent
  install runs a script it downloaded. Its update is `--method npm`, with
  npm pointed at the prefix the executable lives under; an OpenCode in
  `~/.opencode/bin` is left to its own autoupdate (02 open question 11,
  "Decided").
- `versions/mvp/26-bot-routines.md` decided on 2026-10-16 that bot
  routines had no spend guard: the run budget and the overlap guard held
  the cost. On 2026-10-18 the owner asked routines to behave as Grok
  Bot's do, and the guard is back: a nudge, then a pause of every routine
  of the bot when nobody reads what they say. In the same review the
  bot's routine tool lost its per-action table for one consent rule
  (only `list` and `pause` run without a card), and routine changes,
  runs and failures became one activity event written by one listener
  (26 §4, §6, "Decided").
- 2026-10-18, building bot routines' slice C: a routine's activity lines
  belong to no turn, so a turn's several changes are not folded into one
  "Routines in this change" group yet, and a routine turn that failed is
  shown by its turn rather than by a second `failed` notice (26 §4 "In the
  chat", "Decided").
- `versions/mvp/25-bots.md` §4.4 (2026-10-15) built the GitHub reads only,
  and a bot told its owner it could not merge a pull request it had
  reported ready. On 2026-10-20 the asking writes of the table were built
  (comment, review, merge, review session), and issues were added to the
  table: `list_issues`, `get_issue`, and the asking `create_issue` and
  `comment_on_issue`, under the `pulls:*` scopes and the App's new Issues
  permission. A bot's merge is pinned to the head its card showed.
- `versions/mvp/25-bots.md` §4 said a bot "can never do more than the
  person who owns it may do", but no tool checked the owner's roles: only
  a token's scopes narrowed a turn. On 2026-10-20, after the review of the
  pull request writes, the owner's live roles are checked on every call
  and every approved run; a tool they lack stays offered and its call is
  refused, naming the permission to ask for (25 §4).
- `versions/mvp/02-runner.md` §5 (2026-10-18) marked a session's folder
  trusted in Claude Code only for a launch at Approve for me or Full
  access, leaving Ask on "do you trust this folder?". On 2026-10-20 the
  owner asked for every session to start pre-trusted: the runner marks
  the folder before every launch and restart, whatever the permission
  (02, "Every launch starts in a trusted folder").
- The MVP decided "the session view stays a terminal; the Agent SDK stays
  out". On 2026-10-21 a proof of concept added a chat view beside it,
  behind `session_chat_view`: the terminal is still the session view and
  the agent still runs unmodified in tmux, and the chat is read off the
  agent's own transcript, which the runner follows while a browser is
  attached; nothing drives the agent but the PTY
  (`next-steps/0.7-terminal-and-chat.md`, "Proof of concept").
- `versions/mvp/25-bots.md` §7 listed attachments as not built. On
  2026-10-21 (issue #426) images were built (§3.1): a bot on Anthropic,
  OpenAI or ChatGPT reads PNG, JPEG, GIF and WebP sent with a message; GLM
  refuses them. Other files stay unbuilt.
- `versions/mvp/25-bots.md` §1 (2026-10-15) gave a bot a closed list
  ending "no shell, no files … say so and stop", so a bot asked to run a
  build turned it down though `start_session` would do it. On 2026-10-21
  a turn that may start a session gets a "Working on code through
  sessions" section: code work goes to a coding agent on a host, the
  closed list points there, and a turn without the tool keeps the plain
  refusal (25 §1, "Decided").
- `.agents/rules/feature-flags.md` and the catalog had a new feature's flag
  default to `false`, with `true` only for a kill switch over something
  live. On 2026-10-22 the owner asked for every flag to be on by default:
  every boolean flag's `defaultValue` is `true` and `pnpm check:flags`
  fails one that is not, so `workspace_event_stream`,
  `terminal_direct_path` and `session_chat_view` now serve on until
  targeting turns them off or narrows them. `scripts/evals/feature-flags/`
  checks that an agent launching a feature follows it.
- `next-steps/0.4-slack.md` was the Slack integration on its own. On
  2026-10-22 bots gained channels (`next-steps/channels.md`): WhatsApp,
  Slack and email behind one interface, with WhatsApp first as a linked
  device of a number the owner has. Slack as a way to reach a bot is now
  that note's Slack channel; 0.4 keeps its questions about sessions.
- `versions/mvp/25-bots.md` §4.7 planned `delegate` as a subagent for a
  long job whose result arrived later as a message. On 2026-10-22 (issue
  #444) it was built as subagents inside the turn: up to 4 read-only
  children in parallel, bounded and stopped with the turn, whose answers
  the bot reads as data and answers from in the same reply (25, "Decided").
- `versions/mvp/26-bot-routines.md` decided on 2026-10-16 that "when a
  session ends" reaches a bot only as a routine's trigger, with no watch
  table. On 2026-10-22 (issue #445) the owner asked for a bot to subscribe
  to the sessions it delegates, as Grok Bot's watchers do, and to be woken
  when they finish, fail, are stopped or need input. A
  `bot_subscription` now follows one session for the bot that started or
  watched it, and every wake is still a queued turn
  (`versions/mvp/27-bot-subscriptions.md`, 26 §5).
- `next-steps/0.7-terminal-and-chat.md` had the relay never send the chat
  through a share link, so a guest saw only the terminal. On 2026-10-23
  the owner asked for the shared page to have the chat view too: the
  relay judges the flag as the sharer, and the guest gets Terminal / Chat,
  read-only on a read share (0.7, "Wire").
- The console used to open on New session (`/sessions/new`) with Sessions
  first in the rail. On 2026-10-25 Employees moved to the top of the
  rail's default order, and the console opens on the rail's first item,
  so a reader who drags another item to the top opens there instead
  (`versions/mvp/05-screens.md`, `25-bots.md`).
- New session's chips used to sit in a grey band fused to the top of a
  tall composer, under a line saying what sending would do. On
  2026-10-26 it became one box at the pane's foot with a row of choices
  under it and the project over it, and a session's name, state, Terminal
  / Chat and Share moved from the terminal's status line to a bar over it
  (`versions/mvp/05-screens.md`).
- `versions/mvp/28-bots-in-sections.md` decided on 2026-10-26 that only
  Pull requests opens a bot's chat inside the section, and that Sessions,
  Automations and Plan send the reader to Employees, as the export's frames
  link them. Later that day the owner, clicking a bot in Sessions, asked to
  stay on the page: every section now opens the chat in place, under its
  own address and sidebar (28, "Decided").
- New session's Where and Host were two chips. On 2026-10-26 the owner
  asked for the export's one chip, the host and where on it ("mac-studio ·
  New worktree", the hosts and a Start in pane per host); the box took a
  session chat's height, and the models dropped "Claude" from their names
  ("Opus 5.5") (`versions/mvp/05-screens.md`).
- The preview pane the session frame opens beside a terminal was not
  built. On 2026-10-26 the owner asked for the Simulator in it: a
  session's host offers simulators and emulators (`RUNNER_DEVICES`), each
  session holds one, its agent drives it through Argent and the reader
  watches and taps it in the pane, its screen relayed over the link as one
  more attachment kind (`versions/mvp/05-screens.md`,
  `research/device-streaming.md`). The Browser tab is still not built.
