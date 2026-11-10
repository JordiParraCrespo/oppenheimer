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
- `versions/mvp/22-direct-terminal-path.md` bound the direct channel to the
  DTLS fingerprints in the signalling, which the control plane relays, so a
  compromised control plane could sit in the middle of it. On 2026-10-31 the
  owner asked for as much peer to peer as possible and a handshake to harden
  it: `versions/mvp/31-peer-to-peer-and-the-host-proof.md` has the host sign
  both fingerprints with its pairing key on every channel, the browser pin
  the key per host, and orders what moves off the control plane next.
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
- A session started from a task's Start session dialog launched its agent
  at `full` (`--permission-mode bypassPermissions` for Claude Code). On
  2026-11-05 the owner made it start at `auto`, as every other session
  does; `full` stays a choice in the new-session form.
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
- Note 03 keyed the `session.stopped` a hello records for a lost pane by the
  runner's `runId` alone, so a replayed hello wrote it once. That also
  merged a second loss of the same pane, after a restart, on a later link of
  the same runner process, into the first, and the session stayed open on a
  pane that was gone. On 2026-10-31 the key is the run and the link's epoch,
  and the entry is written only while the row is still open and not stopped
  under its lock (03, "Hello reconciliation").
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
- `next-steps/channels.md` bound each channel account to one bot; on
  2026-10-24 routes replaced that (`next-steps/customers-and-routes.md`).
- `next-steps/channels.md` put WhatsApp first and email as a mailbox you
  own; on 2026-10-29 email came first, as an address of the bot's own,
  and the same day reading your own mailboxes went ahead of every channel
  (`next-steps/mail.md`), narrowed to Gmail with drafts and sends.
- `next-steps/mail.md` §3.4 planned a send's files from the bot's chat,
  its documents and its turn as well as from mail; slice 2 (2026-10-29)
  sends files from mail only, and a draft is answered in the chat as text
  with its Gmail link rather than a card (mail.md, "Decided"). The same day
  the chat's images became attachable and the draft got its card; the
  bot's documents and a turn's files stay out (mail.md, "Decided").
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
- `versions/mvp/00-scope.md` said, from 2026-09-23 (#56), that a session
  checks out one repository, because the runner made one worktree per
  session and refused a create with two. On 2026-10-26 the owner lifted the
  cap: the runner makes one worktree per checkout, each in its own directory
  of the session folder, and a session checks out up to five repositories
  (`MAX_SESSION_CHECKOUTS`), the first being where the agent starts unless
  another is named. The bound exists because each checkout is a clone and a
  worktree on the host, and the picker has to stay readable. `SESSIONS_010`
  keeps its code and refuses a repository added to a running session,
  since the wire cannot add a worktree to a live one. Recorded in 00 and the MVP
  decision log.
- The preview pane the session frame opens beside a terminal was not
  built. On 2026-10-26 the owner asked for the Simulator in it: a
  session's host offers simulators and emulators (`RUNNER_DEVICES`), each
  session holds one, its agent drives it through Argent and the reader
  watches and taps it in the pane, its screen relayed over the link as one
  more attachment kind (`versions/mvp/05-screens.md`,
  `research/device-streaming.md`). The Browser tab is still not built.
- `versions/mvp/29-inbox.md` §4 had the cross-bot approvals read list the
  bots the caller may update. Built on 2026-10-26, it lists the bots the
  caller may read, as the per-bot read it mirrors does; deciding a card
  still asks `update`.
- `versions/mvp/29-inbox.md` §3 keyed a session by `observedSince`, which
  only a blocked agent has. Built on 2026-10-26, a failed or stuck launch is
  keyed by its lifecycle's change count (`stateSeq`) instead, and the API
  added both fields to a session and `headSha` to a pull request row.
- `versions/mvp/29-inbox.md` §5 and Decided 1 made the Inbox the rail's
  first item at `/inbox`, with its list in the console's sidebar and the
  item in hand as a card under a greeting and a log. The 2026-10-29 export
  moved it into Plan, and on 2026-10-29 the owner asked for it to look
  like a mail inbox: it is Plan's first section at `/plan/inbox` (the old
  address redirects), the rail item is gone, the console still lands on it,
  and the pane is a list column (search, unread rows with sender, subject
  and a line of body) beside a reading pane (a toolbar, the item as a
  message). The log is gone with the greeting; Show done is the record.
- `next-steps/0.2-pull-requests.md` §6.1 (2026-10-08) pictured one
  notifications token and one optional token for private repositories. On
  2026-10-26 the owner asked for several organisations and, inside one, a
  token per repository if need be: a person adds any number of tokens, each
  opens whatever repositories GitHub says it does, and each repository is
  read with one key chosen at read time (the App, else a pinned token, else
  the narrowest). The notifications wake-up is left for later (§6.2).
- Preview URLs were parked after the MVP (`07-mvp.md` §9). On 2026-10-27
  the owner asked for the Browser tab, through "tunnel technology like
  Cloudflare, Vercel or ngrok"; offered the runner's own link as that
  tunnel, they chose it, asking that an app with an API work. A preview is
  an origin per session and port on a preview domain of its own, served by
  the relay through the link, the app seeing `localhost` and its API behind
  the dev server's proxy; cloudflared and ngrok wait for public share links
  (`versions/mvp/30-session-previews.md`).
- `research/cloud-agents.md` §5 proposed a cloud session as a third
  place of `work_session`. On 2026-10-26 Cursor's cloud agents landed as
  their own module and table instead, since a vendor's agent has no host,
  terminal or checkout to fold (`next-steps/cloud-agents.md`), and F23
  gained a line saying a vendor API key the control plane uses itself is
  not the subscription sign-in it forbids (`04-security-review.md`). On
  2026-10-27 the owner asked for cloud sessions where the other sessions
  are, chosen in New session's place picker, and §5 came back: a cloud
  session is a `work_session` in place `cloud` with no host, its vendor
  run beside it in `session_cloud_run`, its row in the sidebar opening
  the vendor (`next-steps/cloud-agents.md`, `versions/mvp/24-session-places.md`).
  On 2026-10-28, with Claude Code's cloud on `main` as the same place
  started by a host, the owner kept both: two kinds of the one `cloud`
  place, with a host or without, and Grok's to come
  (`next-steps/cloud-agents.md`, "Two kinds of cloud session").
- Bots ran on Anthropic, GLM, OpenAI and ChatGPT. On 2026-10-26 Grok (xAI)
  joined them on the OpenAI engine (`versions/mvp/25-bots.md`).
- `versions/mvp/25-bots.md` §4.2 planned `read_session` as "a session's
  recent output". Built on 2026-10-27 (issue #493), it reads the session's
  event log in words, never the terminal or the agent's conversation, which
  stay on the host; `send_to_session` came with it, gated on the agent
  waiting at its prompt and logged with the bot as sender, and so did
  `answer_session`, which the table did not have.
- `research/cloud-agents.md` §5B ordered cloud places Cursor first, then
  Claude, and said Claude would give no status. On 2026-10-27 the owner
  asked for Claude end to end first: a `cloud` place started by the host's
  runner with `claude --cloud`, and its status reported from claude.ai by
  `apps/extension` (`versions/mvp/24-session-places.md` §7,
  `next-steps/cloud-agents.md`).
- `versions/mvp/05-screens.md` had an empty project show in the sidebar
  with an empty row and a link to start a session. On 2026-10-28 the owner
  asked for the sidebar to list only projects that hold sessions: an empty
  project is not drawn (New session and the project filter still reach
  it), and a sidebar with projects but no session says so in one line.
- `versions/mvp/28-bots-in-sections.md` had a section's Bots plus make a
  blank bot placed there, and placing or hiding any other bot happen in its
  Settings → Profile. On 2026-10-28 the owner asked to manage each page's
  bots from the page: the plus opens a menu with New bot and a check per
  bot for this section, and a row's ellipsis hides it from the section
  (slice D).
- `versions/mvp/24-session-places.md` §7 had Claude Code's cloud only as a
  place in a host's Start in pane. It is now also the Claude Code row under
  Cloud, which picks a host that can start it (2026-10-28).
- `versions/mvp/24-session-places.md` §7's Claude Code row picked the host
  for the reader. It now opens a *Start from* pane where the reader picks
  any host that can, and the engine button offers only Claude Code's models
  in that place (2026-10-28).
- Grok offered sessions 4.7 and 4.6 with six effort levels, `minimal` to
  `max`, and bots 4.7 and Grok Build 0.1 starting on `medium`. On
  2026-10-28 the owner asked for a better Grok catalogue: sessions offer
  4.7, 4.6 and 4.5 and bots add 4.6 and 4.5, each with the levels its own
  menu has (grok 1.0.70 refuses the rest; 4.5 stops at high), `high` the
  default everywhere (`versions/mvp/05-screens.md`,
  `versions/mvp/25-bots.md`).
- 2026-10-28 the owner asked for images in the chats to look and open the
  way Claude's own chat shows them: a bot's images open in a viewer over
  the chat instead of a new tab, and a session's chat, which only counted
  pasted images, now shows them and the screenshots the agent reads, from
  a preview the runner sends within the link's entry bound
  (`next-steps/0.7-terminal-and-chat.md`, `versions/mvp/25-bots.md`).
- `next-steps/cloud-agents.md` had cloud sessions start from New session
  alone. On 2026-10-29 the owner asked for them in Plan's tasks and in the
  automations: Start session and an automation's revision pick where the
  session runs (on a host, Claude Code's cloud from a host, Cursor's with no
  host), and a run with no key for its vendor pauses the automation
  (`cloud_key_missing`; `versions/mvp/24-session-places.md`,
  `versions/mvp/18-plan-product.md`, `versions/mvp/13-automations.md`).
- `next-steps/cloud-agents.md` had a Claude Code cloud session take a task
  and nothing else: a first task's files are saved on the host, which the
  cloud never sees, so the console dropped them. On 2026-10-29 the owner
  asked for them to reach the cloud's agent. The API keeps them in its
  storage under the session, and the task ends with a `curl` line per file
  on a short, day-long link served by the API
  (`GET /v1/cloud-files/{token}`), minted again on every launch; the
  environment's network policy has to allow the API's host
  (`next-steps/cloud-agents.md`, "Files for a cloud session").
- 2026-10-28 the owner asked for bots to send images back: `show_image`
  fetches an image from the web by its address (the only images a bot,
  which has no files, can reach), stores it as the chat's own and draws it
  in the bot's answer (`versions/mvp/25-bots.md` §4.7).
- `versions/mvp/24-session-places.md` §2 put a workspace's stores and
  sessions in `repos/` and `sessions/`, and kept Spotlight out with
  `.metadata_never_index` at the work folder's root. The MVP decision log
  had already measured that marker as not working (2026-10-01), and the
  hidden `.worktrees/` that did work was lost with the move to the work
  folder: on a Mac host every session's checkout, `node_modules` included,
  was indexed again. On 2026-10-28 the two directories became
  `repos.noindex/` and `sessions.noindex/`, the suffix Spotlight skips (as
  Xcode's DerivedData and Orca do), layout version 3, with no migration
  (24 §2).
- A bot's tool answer was cut to its first 12,000 characters. On
  2026-10-29, from Grok Bot's harness (`research/lessons-from-grok-bot.md`
  §9), it keeps its start and its end within that, since a session's
  error is at the end; and a failed turn records a kind, so the chat no
  longer offers Retry where the same message fails again
  (`versions/mvp/25-bots.md` §2–§4).
- A bot's permissions are set in Settings → Permissions, tool by tool, and a
  yes on a card can reach past its call: *Always allow for* the repository,
  project or session it acts on, or *Always allow* for the tool; merging
  stays per call. Plain-language rules are read by a reviewer on the bot's
  own model before an asking call, an ask rule winning and a failed review
  asking. 2026-10-29, from Grok Bot's approvals
  (`research/lessons-from-grok-bot.md` §9 rows 6 and 7;
  `versions/mvp/25-bots.md` §5).
- 2026-10-29 the owner asked to see a bot's subagents while they work:
  "Running 3 subagents" now has a line per child under it (its task,
  waiting or running with its clock or how it ended, the tools it has
  called so far), from frames the bot's stream sends each time one moves,
  until the stored line replaces them (`versions/mvp/25-bots.md` §4.7).
- 2026-11-06 the owner asked to see a session's subagents the way the
  terminal's footer lists them: Claude Code's, Codex's and OpenCode's
  subagents now send their own work beside the transcript, and the chat
  hangs each under the call that started it, a row with its task, kind,
  model, clock, tokens and what it is doing, that opens to its work.
  Grok's stay a row with no work under it (`next-steps/0.7-terminal-and-chat.md`,
  "Subagents").
- 2026-10-29 the owner asked for Codex cloud tasks the way Claude Code's
  cloud works, though the research note put Codex cloud last: a Codex row
  under Cloud starts the task from a host with `codex cloud exec`, and the
  host, not the browser extension, reports its status off
  `codex cloud list --json`, since Codex's CLI answers it
  (`next-steps/cloud-agents.md`, `versions/mvp/24-session-places.md` §7).
- `next-steps/cloud-agents.md` had a Codex environment named neither for
  the repository's full name nor its bare name be the CLI's refusal, in its
  words (`SESS_009`). On 2026-10-31 starts failed "not found" on
  environments made in ChatGPT Settings → Codex Cloud, which codex-cli
  0.166.0 cannot reach (it resolves only the list `codex cloud` browses).
  That is now `SESS_010`, naming the labels tried and the labels on the
  account's recent tasks, the one non-interactive view codex-cli offers,
  partial; the failed start's pane explains it with a link to Settings →
  Codex Cloud. The place picker does not mark the Codex row for it, since
  a partial list would hide starts that work
  (`next-steps/cloud-agents.md`, "Environments the CLI cannot reach").
- A bot's watch woke it only on a task's state. On 2026-10-29, from Grok
  Bot's shell watches (`research/lessons-from-grok-bot.md` §9 rows 8 and
  9), it can also wake on a line the terminal prints that matches a
  pattern. The runner matches it on the host and sends only a count, so
  pane text still never reaches Postgres. A bot can also wait up to 120 s
  inside its turn, and read a session's log from the entry its own input
  followed (`versions/mvp/27-bot-subscriptions.md` §2,
  `versions/mvp/25-bots.md` §4.2).
- Row 10 of `research/lessons-from-grok-bot.md` §9 placed goals in note 26
  as a routine the bot sets on itself. On 2026-10-29 they were built
  instead as a goal of their own in `versions/mvp/25-bots.md` §4.1. A
  routine's run is a schedule's slot, but a goal goes on when the bot's
  last turn ends. So it is a bounded count of continuation turns, at most
  10, keyed in the turn queue like a wake, with Stop above the composer.
- Note 25 §7 listed user memory as not built. On 2026-10-29, from Grok
  Bot's memory (`research/lessons-from-grok-bot.md` §9 row 11), a fact
  gained a tier (in the prompt, or looked up with `recall`) and a scope
  (the bot's, or about the person and read by all their bots), on the same
  table (`versions/mvp/25-bots.md` §4.1). Project memory stays in §7.
- Note 25 §4.7 listed `ask_user` as a question card with no design. On
  2026-10-29, from Grok Bot's form cards (`research/lessons-from-grok-bot.md`
  §9 row 12), it was built as a card of up to four questions, a card of its
  own beside approvals that is answered or dismissed and never approved,
  with one card of either kind up per bot (`versions/mvp/25-bots.md` §3.2).
- Row 14 of `research/lessons-from-grok-bot.md` §9 placed CI findings in
  the review session's result. On 2026-10-29 they were built as a bot's
  tool, `record_ci_findings`, filed on the pull request's head and shown
  with its checks (`next-steps/0.2-pull-requests.md`, "CI findings"). A
  review session has no channel back to the control plane yet
  (`review.report` is unbuilt).
- 2026-10-29 the owner asked for bots to be dragged into order on every page
  that shows them. There is still one order, the Employees order, and no
  per-page one: a section's Bots heading now drags its rows too, and a drop
  there moves the bot in Employees (between the same two bots, keeping its
  group when a neighbour is in it), so every heading follows. The bots list
  the API serves is that order (groups by position, then Ungrouped); it had
  been Ungrouped first with groups by id, so a heading's order differed from
  Employees' (`versions/mvp/28-bots-in-sections.md`, Decided).
- `versions/mvp/27-bot-subscriptions.md` §2 had `queued` and `in_progress`
  never wake a bot, so a delegated task stuck before it began (its host
  offline, its agent at a folder-trust or sign-in prompt) left the bot
  silent until somebody asked. On 2026-10-29 the owner asked for it to
  "monitor a bit what it has done", and chose, over a progress update
  (which Grok Bot, Codex and Claude Code do not send), a silent stall
  check: five minutes after `start_session` or `send_to_session`, a job
  reads the task and wakes the bot once, as `stalled`, only if it never
  started or its agent was never seen working (27 §4.1).
- `versions/mvp/25-bots.md` §4.1 (2026-10-29) had a goal end only when the
  bot called `end_goal`, the owner stopped it, a turn of it failed or its 5
  continuations (up to 10) ran out. On 2026-11-02 the owner asked for bots
  to come with basic commands like Claude Code's `/goal`, in the order
  `/goal`, `/usage`, `/loop` or `/schedule`, `/plan`, `/grill-me`. They are
  built-ins, product code with reserved names, not skills. `/goal
  <condition>` sets the goal as the person, and a reviewer on the bot's own
  model judges it after every turn (met, not met, impossible), as Claude
  Code's evaluator does; a person's goal takes up to 20 continuations, a
  bot's 5 unless it asks for up to 20 (25 §4.1, "Built-in commands").
- `versions/mvp/26-bot-routines.md` §4 (2026-10-18) had every routine
  save by the bot ask the owner first, except on the Routines tab. On
  2026-11-03 `/schedule <request>` was built (25 §4.1): the bot saves the
  routine the person's command asks for, and that one create raises no
  card, since the command is the consent. Changes, deletes and runs still
  ask.
- `versions/mvp/25-bots.md` §4.1 (2026-11-02) planned `/loop` or
  `/schedule` as a routine of the bot's (26). On 2026-11-03 the owner chose
  `/loop`, and it is its own built-in instead: routines run on a calendar
  and last until deleted, while a loop runs every few minutes (1 minute to
  1 day, or when the bot chooses), belongs to the chat it was typed in and
  expires after 3 days. `/schedule` stays planned as a routine (25 §4.1).
- `versions/mvp/25-bots.md` §4.1 (2026-11-02) drew `/usage` as three lines
  of this chat's figures and left the context and plan windows to the
  composer's meter. On 2026-11-03 the owner asked for a card like Claude
  Code's small usage card, and smaller: the command as a bubble, then a
  384px card with the plan's 5-hour and weekly windows as bars, this chat's
  figures in a grid and the tokens' breakdown (25 §4.1).
- 2026-10-31: the owner took the six chat slices drawn from a read of Codex
  and Grok (`research/lessons-from-codex-and-grok-chat.md`); they are listed
  in `next-steps/0.7-chat-protocol.md`.
- `versions/mvp/25-bots.md` §5 (2026-10-15) had every no on a Needs input
  card give the bot a turn that tells it, so it always carried on. On
  2026-10-31 the card took Codex's `available_decisions`: the API chooses
  the decisions a card offers (approve, approve for its subject, always
  allow, deny, deny and stop) and accepts only those. *Deny* still gives
  the bot a turn; *Deny and stop* gives it none, writes the decision as a
  line outside any turn, and stops the asking turn if it still runs. Every
  decision is broadcast as `approval_resolved`, so every open tab takes the
  card down at once (25 §5).
- `versions/mvp/25-bots.md` §5 (2026-10-15) gave the bot one turn after a
  yes, once the approved call had run, so the chat was silent for the
  call's whole run and the model's first token after it. On 2026-11-02 the
  owner asked for the bot to answer first, as a person does: a yes now
  queues a short "on it" turn at once, the chat shows the call running
  under it, and the report is its own turn after, drawn "Done: …" (25 §5).
- `versions/mvp/25-bots.md` §3 had a message written while a bot works
  wait over the composer for the turn after. On 2026-10-31, from Codex's
  `turn/steer`, Enter steers the running turn instead: the turn takes the
  message at its next tool call, and one it never reaches runs as its own
  turn; Alt+Enter still queues it for after
  (`next-steps/0.7-terminal-and-chat.md`, "Steer in the bots chat").
- The bot stream was lossy by design: text published while the browser was
  away was gone, and the console matched what it streamed against stored
  text to avoid drawing it twice. On 2026-10-31 a running turn's unstored
  text is kept beside the channel and sent as a snapshot when the browser
  connects, and the console reconciles by block and sequence number, the
  stored message being the authority (`versions/mvp/25-bots.md` §2,
  `next-steps/0.7-chat-protocol.md` slice 2).
- Note 25 §7 listed slash commands among what bots did not have yet. On
  2026-10-31 the owner asked how OpenClaw and Grok Bot support skills
  (`research/lessons-from-openclaw-and-grok-bot-skills.md`) and for slash
  commands; they were built as a bot's skills: one row each, listed by name
  and description in every prompt and read with `use_skill` when used,
  saved by the bot with `save_skill` or by hand in Settings → Skills, and
  run by the person as `/<name>` (`versions/mvp/25-bots.md` §4.1, Skills).
- `next-steps/channels.md` placed WhatsApp third among the channels, after
  email and contacts, and as a channel (people write to a bot). On
  2026-10-30 the owner asked for it first, the way OpenClaw does it, so that
  bots can see and talk with people: it was built as a connector in mail's
  shape on the channels note's runner transport, and the control plane now
  keeps the messages a linked number sees for 90 days
  (`next-steps/whatsapp.md`). The channel comes after, on the same device.
- Codex cloud sessions named their environment by guessing its label from
  the repository (`next-steps/cloud-agents.md`, "Codex is built"). On
  2026-10-31 a session failed on an environment labelled otherwise, and
  the owner asked to improve environment management: the host now lists
  the ChatGPT account's environments and starts the task in the one linked
  to the repository, and New session has an Environment chip to pick
  another, kept with the session's launch (`next-steps/cloud-agents.md`,
  "Which Codex environment"). To list them the host reads the Codex CLI's
  sign-in, which "Environments the CLI cannot reach", decided the same day,
  had ruled out; which holds is open, for the owner.
- `next-steps/mail.md` §3.5 kept `trash_mail` asking every time, Full
  access included, with no Allow and no "always" on its card. On
  2026-11-02 the owner, cleaning a mailbox a batch of 25 at a time, asked
  that it can run on its own once they grant it: it still asks under every
  preset until then, and Always allow on its card or Allow in Settings
  makes it standing. Sends (§3.4) still ask every time and cannot be
  allowed.
- `next-steps/0.7-terminal-and-chat.md` opened a session on Terminal, with
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
- `next-steps/0.7-terminal-and-chat.md` sent a session's whole transcript,
  from its first line, on every attach (`reset` and the history). On
  2026-11-04 a Claude Code session's attach sends its last 40 turns
  instead, with `before`, the offset they start at, and the console asks
  for the 40 before that (`chat.older`, `attachment.chat.older`) as the
  reader scrolls to the top: a long conversation was megabytes read,
  sent and parsed to draw its end.
- Note 13 said herdr's agents do not survive a restart and took its screen
  manifests as the model for agent state. herdr-core, its successor, keeps
  programs alive across its own restarts and takes status only from the
  program (OSC 7501), which Claude Code speaks once the terminal answers
  its probe; tmux does not. On 2026-11-02 the agent's own report became the
  first source of a session's state, above the screen manifests, through
  the runner's `runner pty` wrapper (`research/lessons-from-herdr.md` §4,
  `versions/mvp/02-runner.md` §9).
- `versions/mvp/02-runner.md` §5 and §12 said a reboot leaves every session
  stopped until someone presses Restart. On 2026-11-02 a session marked
  kept (`runner sessions keep`) is restarted on its own after a reboot,
  reopening its conversation; the rest still wait for Restart.
- `next-steps/0.6-mcp-cli-and-agent.md` placed delegation (`spawn_task`,
  `wait_task`, `send_message`) behind an MCP server in the 0.6 slice. On
  2026-11-02 the host-side half landed in the runner instead, ported from
  herdr-core: an agent in a session starts, tells and waits on child
  sessions with `runner sessions run|send|wait|report` (`runner --skill`).
  The control-plane half, a child the console lists, is still 0.6's.
- `next-steps/0.7-chat-protocol.md` kept the agent's transcript file the
  one source of the session chat, and `0.7-terminal-and-chat.md` named a
  second file reader as how another agent joins. OpenCode keeps no such
  file: its conversations are in a database whose tables move between its
  versions. On 2026-11-02 OpenCode sessions got the chat by another source:
  the runner launches OpenCode serving its own API on a loopback port with
  a password of the session's, and follows the conversation through that
  API, writing each finished part as a line in the transcript shape the
  console already reads. Claude Code still reads its file.
- `versions/mvp/25-bots.md` §4.1 stopped a goal when any turn of it
  failed, since a failure would only fail again. A turn stopped at the
  4-minute limit for one turn is the exception, decided on 2026-11-02 after
  a mail-cleaning goal stopped at its first long turn: the goal is the way
  past that limit, so that turn is reviewed and the next continuation goes
  on, told to take a smaller step.
- `versions/mvp/05-screens.md` listed Claude Code's models as the newest
  of each line, Haiku 4.5 among them. On 2026-11-02 the owner asked for
  the list Claude's own picker shows: Opus 5.5, Fable 5.1, Sonnet 5.5 and
  Haiku 5.5, then Haiku 4.5, Sonnet 5, Opus 5, Fable 5, Opus 4.8, 4.7, 4.6
  and Sonnet 4.6 behind "More models" — the catalog's `legacy` models.
- `versions/mvp/29-inbox.md` built the Inbox only from what the system
  already knew, with no way for an agent to post into it. Since 2026-11-02
  an agent in a session can: `runner sessions notify "line"` keeps the line
  on its session, and the Inbox lists it until it is marked done
  (`next-steps/agent-tools.md` §2). Since 2026-11-03 a bot can too, with
  its `notify` tool: its latest line is a `botNotice` item, and the Type
  facet's "Bot approvals" is "Bots" (§5).
- `next-steps/agent-tools.md` §1 kept a shared file between the host and
  the browser attached to the session's chat; the control plane never
  heard of it. Since 2026-11-03 the runner also logs `file.shared` with
  the file's metadata (never its path or bytes), the session keeps the
  last 20, and a bot lists them and shows an image's preview, asked of
  the host over the link (`next-steps/agent-tools.md` §7).
- `versions/mvp/27-bot-subscriptions.md` §1 had every wake re-read what it
  follows as the bot's owner and wake for what holds now, and §7 planned
  pull requests from the pull-requests module's webhooks. Built on
  2026-11-03, a bot following a pull request (`watch_pull_request`) is woken
  by the inbound-events hub's GitHub events instead, and its wake is the
  event's metadata alone, never a re-read: the pull request is GitHub's, not
  ours to re-read on every event. A close without a merge makes no event
  yet, so only a merge ends it (27 §7.1, `next-steps/agent-tools.md` §6).
- `versions/mvp/25-bots.md` treated text from tools as information, not
  instructions, and left every tool to the turn that reads it. On
  2026-11-03 a pull request watch made that text a stranger's comment
  starting an unattended turn, and Codex's review asked for narrower tools
  on such turns. The owner chose full autonomy instead: those turns keep
  every tool, and the prompt carries the defence, each GitHub author named
  as a collaborator or as outside the repository and a rule against putting
  private information where outside text points (27 §7.1).
- `versions/mvp/25-bots.md` (2026-10-21) told a bot that a session was
  "the expected way, not a last resort" for code work, so bots opened one
  for questions the web could answer. On 2026-11-05 the owner asked for
  research first: a bot answers with its own tools, web search and
  `web_fetch` when it can, and starts a session only for work that needs a
  shell or a checkout, or when asked.
- `next-steps/cloud-agents.md` had a cloud session followed up only at its
  vendor (`SESSIONS_039` for Cursor's). Since 2026-11-05 a Cursor session
  takes a follow-up through Oppenheimer as a new run of its agent, on the
  launcher's key and only once its last run ended; Claude Code's and
  Codex's still take none here ("Follow-ups to a cloud agent").
- `read_session` read a session's log and never its agent's conversation,
  which reached only a browser attached to the chat. Since 2026-11-05 a
  bot, `opp` and MCP read it a page at a time off the host, redacted, with
  a status that says how complete each page is; a cloud session's is
  unsupported, with its vendor's link (`next-steps/agent-tools.md` §8).
- `next-steps/agent-tools.md` §2's notice reached the Inbox only. Since
  2026-11-05 it also wakes every bot that follows the session, once per
  notice (§9).
- `versions/mvp/25-bots.md` §2 sent a turn the newest messages that fit
  its history budget, and the OpenAI engine named no conversation to the
  provider. On 2026-11-03, after `/usage` showed a bot on GPT and Grok at a
  1% cache hit rate, each request carries the bot's id as its
  `prompt_cache_key`, and the history loses its oldest messages a block of
  about 6,000 tokens at a time, so each turn's request starts as the last
  one's did.
- `versions/mvp/25-bots.md` §4.3 listed `create_project` and
  `update_project` as asking first. On 2026-11-03 (issue #647) they were
  built to run under Approve for me like the task writes, since a project is
  metadata and an edit can be put back; `archive_project`, which cannot be
  undone, asks under every preset, one call at a time. `move_session` was
  added, and the workspace stream gained `project.changed`.
- `versions/mvp/10-api-modules-and-data-model.md` kept an archived project
  for ever with no way back ("there is no un-archive"). On 2026-11-03 the
  owner asked for restore: `POST /projects/{id}/restore` and the bot's
  `restore_project` bring the same row back with its slug, so a slug is
  still never reissued. The automations its archive paused stay paused.
- `versions/mvp/29-inbox.md` §1 ordered the Inbox most blocked first:
  approvals and waiting sessions oldest wait first, then requested
  reviews, ready merges and failed runs. On 2026-11-03 the owner asked for
  the most recent first, so the list is newest first across every kind,
  Low items still last; the order is held by the consumer's
  `composeInbox` test, no longer by the fleet stress suite.
- `next-steps/0.6-mcp-cli-and-agent.md` asked whether the CLI is a new app
  or `runner` grows user commands, and noted the starter's CLI and MCP apps
  were pruned. On 2026-11-02 both came back as their own apps, `apps/cli`
  (`opp`) and `apps/mcp`, clients of the API on scoped tokens: they reach
  automations, bots and tasks, which are not the runner's to forward. The
  runner keeps the same-host verbs.
- `next-steps/cloud-agents.md` left bringing a Claude Code cloud session
  back as a command to copy, with no button that opens a worktree session.
  On 2026-11-03 the owner asked to pick the host from the session's pane:
  *Continue on a host* starts a worktree session there whose agent runs
  `claude --teleport <id>` (`teleport` on the create, runner capability
  `session.teleport`). Codex's `codex apply` stays a command.
- `next-steps/mail.md` §5's build log (2026-10-29) had an account start
  from the moment a routine *first* watched it, so a mark kept through a
  pause or a revoked grant replayed the gap's mail as new. On 2026-11-04 an
  account the poll does not read loses its mark and starts again from now;
  mail older than two days, spam, trash and chats never wake a routine, an
  any-mail trigger takes only the inbox, and rate-limited runs are one chat
  line a routine an hour.
- `versions/mvp/05-screens.md` had the Sessions sidebar make projects (a
  plus in its head) and edit them (a settings glyph on each project's
  header). On 2026-11-05 the owner moved project management to Plan: a
  **Projects** view in Plan's sidebar (`/plan/projects`) lists the
  workspace's projects with New project and each one's settings, and the
  Sessions sidebar keeps only New session here on a project's header.
  New session's project chip still ends in New project….
- The 2026-11-05 line above left the Sessions sidebar no way to make a
  project. On 2026-11-07 the owner asked for one back, in the filter menu:
  the Project facet's list ends in **New project…**, opening the project
  dialog (`05-screens.md`). Editing projects stays in Plan.
- `versions/mvp/18-plan-product.md` drew Plan's board as Later, To do, In
  progress and Done. On 2026-11-05 the owner dropped **Later** and added
  **In review** between In progress and Done, for finished work waiting to
  be looked at. Tasks that were in Later moved to the end of To do
  (migration `ReplaceLaterWithReviewColumn`); attaching a session still
  moves only a task in To do to In progress.
- `versions/mvp/25-bots.md` §4.1 (2026-10-29) kept a bot's facts as
  `profile` by default, the newest 60 in every prompt, `log` facts only
  through `recall`, and refused a save past 200. Bots saved almost nothing
  after their first chat. On 2026-11-06, after a read of Grok Bot 0.79.2
  (`research/lessons-from-grok-bot.md` §10), the owner took its shape: a
  bot's save is `log` by default, the system prompt carries the newest
  profile facts by characters (4,000) and the turn context the newest log
  entries (2,000, dated), so a save leaves the prompt cache warm, the turn's
  rules tell it to save what it learns without asking, and a full memory
  of 500 drops its oldest log fact instead of refusing.
- `versions/mvp/26-bot-routines.md` §6 (2026-10-16) said a bot gets a
  heartbeat only when asked for one in chat, through `update_routine`. On
  2026-11-06 the owner asked for bots to be proactive by default, the way
  OpenClaw's are: a bot is now given a **Heartbeat** routine as soon as it
  has a job (its `INSTRUCTIONS.md` first written), hourly at a minute
  spread by its id, saved as its owner within the scopes of the credential
  that wrote the job, which the owner pauses or deletes like any routine.
  A beat with nothing to say calls `nothing_to_report`, offered only on
  turns nobody is waiting on. Bots that had a job before get none until
  asked (26 §6, "Decided").
- `versions/mvp/26-bot-routines.md` §6 (2026-10-18) designed the routines'
  spend guard as a nudge card, then a pause with a card to resume, and a
  per-bot "don't ask again". On 2026-11-07 the owner asked for it to work
  like an agent that stops watching a pull request: it stops on its own and
  comes back when the person does. Built that way: after 3 routine reports
  the owner has not seen, or 72 h away from the bot's chat, every routine
  of the bot pauses as `unattended` with one Inbox line, and the owner's
  next visit to the chat (or message, or decided card) resumes them. No
  cards; the thresholds are workspace automation settings, and a per-bot
  "Pause while you're away" switch turns it off (26 §6, "Changed
  2026-11-07").
- `versions/mvp/25-bots.md` §4.1 (2026-10-29) left what a bot knows about
  its owner spread across their bots: each `person` fact was edited on the
  bot that learned it, read only on the others, and the owner had no place
  of their own. On 2026-11-07 the owner asked for one page, the way
  Claude's memory works: Settings → Memory, at the account, holds an
  *About you* text the owner writes (table `person_memory`, migration
  `AddPersonMemory`), in every bot's system prompt and never written by a
  bot, and lists every `person` fact their bots learned, each still the row
  of the bot that keeps it and changed there.
- `next-steps/cloud-agents.md` ("Follow-ups to a cloud agent") said a
  Claude Code cloud session's conversation is not ours to read, so the
  console only linked to claude.ai. On 2026-11-07 the owner asked for its
  chat in the console: two hooks in the session's repository send its
  transcript to the API and collect replies typed in the console ("The chat
  of a cloud session"; `research/cloud-chat-bridge/`).
- `versions/mvp/25-bots.md` §7 (2026-10-14) made a bot's avatar its
  initials on one of eight colours. On 2026-11-07 the owner asked for
  better avatars: each bot now has a drawn face, a hatted face in its
  colour cut out like a sticker, generated from its id. The same day the
  product's mark became a white fedora on an ink tile (favicons, the
  extension, `BrandMark`, the console rail's top as a link home, beside the
  name on sign-in and the public pages; the console's sidebar header is the
  name alone), replacing the starter's asterisk, the rail's "O" and the
  three-part hat favicon. A bot's owner can also pick its face in Profile
  (hat, eyes, mouth).
- `versions/mvp/25-bots.md` §1 had a bot report a failed session and stop
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
- `versions/mvp/25-bots.md` §2 (2026-10-29) told a bot to report only what
  a tool confirmed, which left the checking to the bot's judgement. On
  2026-11-07 a bot started a cloud session that could not start and said
  so only when asked, and the owner asked bots to always check. The prompt
  now has one section, "Check before you report": an action's tool answer
  is read, then read back where a tool can, a failure is said first and
  unasked, and a coding agent's report is a claim checked against its
  evidence.
- `versions/mvp/25-bots.md` §4.2 (2026-10-30) left `start_cloud_session`
  unwatched, since a cloud session is followed at its vendor, and §2's
  closed list quoted each tool's first sentence. On 2026-11-07, after a
  review of every prompt, a cloud or review session is watched like any
  other (a failed cloud start had gone unreported), and the list names the
  tools by area: quoting them made it 62% of the system prompt.
- `versions/mvp/25-bots.md` §2 (2026-10-15) bounded a turn by 20 round trips
  and 4 minutes but failed it only past the time; one that used its steps
  ended completed, with nothing said. On 2026-11-08 it fails with
  `step_limit`, saying so, and goals and loops go on past it as past the
  time limit (`TURN_LIMIT_FAILURES`).
- `versions/mvp/25-bots.md` §2 (2026-10-15) folded a bot's chat into its
  summary past 1.5 times the history budget, while the history dropped old
  messages at the budget, so up to about 12,000 tokens were in neither. On
  2026-11-08 the fold starts below the budget, with room for the longest
  summary and the notes on earlier images (`BOT_SUMMARY_TRIGGER_TOKENS`).
- `versions/mvp/20-plan-calendar.md` (2026-10-13) drew the calendar as a
  month only and asked whether a week view came before Google
  write-back. On 2026-11-08, after that day's `Tasks` frame, it opens on
  Day, with Week and Month beside it, a task due at a time standing on
  the hours at that time, and Plan gains To do, one day's tasks (§6).
- `versions/mvp/25-bots.md` §2 (2026-10-15) left a turn's tool calls out of
  the history, as the bot's own working, so a later turn knew what its
  tools did only from what it had said. On 2026-11-08 they come back as a
  short record from Oppenheimer, fenced as data and bounded per call and
  per turn (`activityText`), and the summary and the goal reviewer read the
  same record.
- `versions/mvp/25-bots.md` §2 (2026-10-29) told a bot how full its context
  was only against a known window, so a bot on the OpenAI engines, which
  report none, was never told. On 2026-11-08 it is told its tokens, and
  asked for narrow reads from `BOT_CONTEXT_TIGHT_TOKENS`; the note no
  longer says every engine compacts on its own.
- `versions/mvp/25-bots.md` (2026-10-15) gave bots no shell at all: code
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
- `versions/mvp/25-bots.md` §2 said a bot "delegates a complete task and
  never runs a terminal". On 2026-11-08 the owner asked for bots that drive
  bash and ssh themselves: `open_terminal`, `type_in_terminal` and
  `read_terminal` type into a blank-terminal session and read its screen,
  only on a host whose `runner exec` mode is `full`. A coding agent is still
  given a task, never typed at.
- `versions/mvp/25-bots.md` §4.1 (2026-10-29) let a bot file a fact as
  "about the person (their name, their role, their preferences)", read by
  all their bots. Bots filed their job there: Facturas read another bot's
  XRP Mobile project and pull request notification setting. On 2026-11-08
  the owner asked for two memories made plain, a general one and one per
  bot: `remember` takes `memory: 'yours' | 'general'`, the prompt names
  *Your memory* and *General memory*, and general takes only what a bot
  with a completely different job would need (`scripts/evals/bot-memory`).
- `versions/mvp/02-runner.md` §5 said a base that is not a branch on the
  remote fails the create. On 2026-11-08 a project on an empty GitHub
  repository could not start its first session for that reason, so an
  empty repository (no ref at all) is the exception: the create pushes an
  empty `Initial commit` to the base and cuts the session from it. A
  prepare leaves it empty; a repository with other branches still fails.
- `versions/mvp/25-bots.md` §2 bounded a bot's turn at 20 model round
  trips and 4 minutes, and §4.1 a goal at 20 continuations with a reviewer
  after each turn. On 2026-11-09 the owner asked for tasks that run for
  hours: Codex, Grok Bot and OpenClaw cap neither
  (`research/lessons-from-long-running-agents.md`). A turn now runs until
  the model answers, compacting mid-turn on every engine, stopped only by
  a silent model or the loop guard; a goal has no limit, the bot says when
  it is done and the reviewer checks that claim, and a goal that goes
  wrong pauses for the owner to resume instead of ending.
- `versions/mvp/25-bots.md` §4.1 paused a goal on a provider's usage limit
  for the owner to resume. On 2026-11-09, where the provider says when the
  limit ends, the goal waits for that time and goes on by itself; it pauses
  only when no time is known.
- `versions/mvp/11-api-implementation-plan.md` (GitHub slice) had the
  webhook read `request.rawBody`, the copy Better Auth's app-wide JSON
  parser kept, so it needed no bootstrap change. That parser's 100 kB
  default refused ordinary `push` and `pull_request` deliveries with a 500
  (Sentry OPPENHEIMER-API-2, 2026-11-09). The webhook now reads its own body
  raw, up to GitHub's documented 25 MB cap, ahead of the app-wide parsers;
  a larger body is a 413, and the `rawBody` copy is gone.
- `versions/mvp/18-plan-product.md` §1 (2026-11-05) listed Plan's Projects
  as a row per project with its settings. On 2026-11-08, following that
  day's `Tasks` artboards, each project is a card (its repositories, and
  Needs input, Running or Idle from its sessions) that opens the project's
  page, `/plan/projects/<id>`: its milestones, the tasks waiting on a
  person, the ones in progress, and Settings. The artboard's Chat and Stats
  tabs on that page are not built: there is no per-project agent or
  per-project statistics yet.
- The 2026-11-08 line above left the project page's Stats unbuilt, saying
  there were no per-project statistics; `GET /plan/stats?projectId=`
  (`versions/mvp/23-plan-milestones-stats-accounts.md` §4) had them. On
  2026-11-09 the owner asked for it: the page switches between Overview and
  Stats, which reads that endpoint over a period. Pull requests stay off it
  until the endpoint carries them (23, decided 4).
- `versions/mvp/25-bots.md` (2026-11-08) made `recap` something the person
  asks for: `/recap` in a bot's chat, "recall" in a session. On 2026-11-09
  the owner asked for it at the end of every finished task as well: a bot's
  wake for a finished session ends with a recap of it, a session's agent
  ends each task it finishes with one, and so do agents working in this
  repository (the `recap` skill).
- `versions/mvp/20-plan-calendar.md` §6 (2026-11-08) had To do list a
  day's tasks by their due date. On 2026-11-09 the owner asked for it to be
  what they mean to work on: a task has a focus date apart from its due
  date, To do lists what is put on the day and what is due on it, keeps
  unfinished work from earlier days until it is done, and opens a task's
  dialog on To do rather than on the board (§6, "Changed on 2026-11-09").
- `next-steps/channels.md` §5 and §6, `next-steps/customers-and-routes.md`
  §5 and `next-steps/telegram.md` §2 and §3 changed on 2026-11-09, when the
  owner's `/start` went unanswered: the decision is
  `next-steps/answering-on-telegram-and-whatsapp.md`.
- `next-steps/answering-on-telegram-and-whatsapp.md` §1 (2026-11-09) had the
  spare WhatsApp number send your personal number a code you send back from
  it. On 2026-11-09, building slice 3, the code became one you enter in
  Settings → WhatsApp instead: sent back from the named number, a stranger
  who owns a mistyped number would receive it and become your line. A bot's
  reply to your own message there counts only against the host's send
  budget, not the 100 bot sends a day (`next-steps/whatsapp.md` §4).
- `versions/mvp/29-inbox.md` said, from 2026-10-25, that the Inbox stores
  nothing but your marks and that no agent posts into it. On 2026-11-09 the
  owner asked for the unattended agents to send him problems with images
  and to answer them only in the Inbox: a report is now stored
  (`inbox_report`, up to four pictures), sent by anything holding a token
  with `inbox-reports:write`, answered from its card, and read back by the
  agent that sent it (29, "Reports").
- `versions/mvp/05-screens.md` listed Fable 5.1 among Claude Code's four
  current models. On 2026-11-09 the owner asked for Fable 5.2 in new
  sessions and in bots: it takes Fable 5.1's place, and Fable 5.1 heads
  "More models", since Claude still serves it. OpenCode's `anthropic/` row
  moves to Fable 5.2 as well, with Fable 5.1 behind its "More models".
- `versions/mvp/29-inbox.md`, "As built", had Plan open on its Inbox. On
  2026-11-09 the owner asked that Plan open on the view dragged to the top
  of its sidebar: the rail and the console's landing go through
  `/plan/open`, which redirects there (the Inbox until another is dragged
  above it).
- `versions/mvp/25-bots.md` §4.1 (2026-10-31) had a bot save a skill only
  when the person asked. On 2026-11-09, from Hermes Agent's learning loop,
  a bot may save one on its own after hard work likely to come again (at
  most one a turn, never anything private), a turn someone waits on that
  has run 8 tool calls with no skill used or saved reminds it once, and
  `patch_skill` fixes one passage of a skill. Either tool changes a skill
  the person wrote last only when they asked, and neither touches the
  skills Oppenheimer gives every bot.
- `versions/mvp/25-bots.md` §4.1 (2026-11-09) reminded a bot after 8 tool
  calls, in a line it was never told about, and `use_skill` did not say
  who wrote a skill. On 2026-11-10 the skills paragraph announces the
  reminder (Oppenheimer's own `<oppenheimer_reminder>` line at the end of
  a tool's result, which a tool's output cannot forge), the reminder comes
  after 6 calls, work the person says comes back is reason enough to save,
  and `use_skill` says whether the bot or the person wrote the skill last.
- `versions/mvp/25-bots.md` §4.2 (2026-10-27) had a bot find a session only
  by listing them, newest first, and read one it already had the id of. On
  2026-11-09, from Hermes Agent's session search, a bot searches every
  session of the workspace, on any host and closed ones included, for words
  in its name and log (`search_sessions`); the agents' transcripts on the
  hosts are not searched. The `recap` skill searches its topic the same way.
- `versions/mvp/25-bots.md` drew a turn's compaction as a quiet line among
  its calls, the trace at the reply's 15px in muted ink, and the live
  line's orb as `composing`. On 2026-11-09 the owner asked to stop seeing
  compactions, for quieter tool calls and for the solving and searching
  orbs: the chat draws no compaction (the export keeps it), the trace is
  13px in subtle ink, and the orb solves, or searches while the running
  call only looks around (`versions/mvp/25-bots.md` §2 and §3).
- `versions/mvp/18-plan-product.md` §4 had Start session always start from
  one of the project's repositories. On 2026-11-09 the owner asked to start
  one with only a host: the Repository chip offers No repository, which on
  a host opens the session in the host's home folder.
- `versions/mvp/27-bot-subscriptions.md` gave a task a bot hands off one
  stall check and "no progress update", and its prompt told a bot asked to
  monitor that "checking now adds nothing". On 2026-11-10 the owner had to
  tell Facturas "you should be babysitting this" while two of its agents sat
  idle: a bot now looks at a task still running every ten minutes after the
  first check, up to an hour, staying quiet when it is on track, and checks
  at once when asked (§4.2).
- `versions/mvp/25-bots.md` §4.2 had `start_session` launch every session
  at `auto` on the host's default model, decided 2026-10-18. On 2026-11-10
  a bot told the owner it could not start a session on Opus 5.5: the tool
  now takes everything the composer offers (model by id or name, effort,
  permission, base branch), refuses what the agent does not take with what
  it does, and names each choice on the card. `auto` stays the default,
  and a session at full access is approved on its own card, every time.
  An eval holds it (`scripts/evals/bot-session-launch/`).
- `next-steps/0.2-pull-requests.md` ("The screens as built", 2026-10-13)
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
- `versions/mvp/05-screens.md` left plain **Ctrl+V** to the program off
  the Mac, pasting only on Ctrl+Shift+V. On 2026-11-10 the owner pasted a
  screenshot into the terminal with Ctrl+V and Claude Code, reading the
  host's clipboard, said "No image found in clipboard". Ctrl+V now pastes
  off the Mac too, as ⌘V does on it, so a pasted image is uploaded to the
  host; a program that wanted a literal ^V no longer gets one from it.
