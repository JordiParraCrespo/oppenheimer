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
| 12 | [Lessons from Grok Bot](12-lessons-from-grok-bot.md) | A reconstructed desktop agent app: brokered descriptors with hints, resumable migration streams, recreate-with-data updates, disk pressure, epoch-guarded reconnects; what we do not take |
| 13 | [Lessons from herdr](13-lessons-from-herdr.md) | herdr's source read in full: where it puts the process boundary and what that costs, agent manifests as versioned data with priorities and guards, hooks over scraping; and a 340-line SSH web terminal as the list of what not to do |
| 14 | [Session boot time, measured](14-session-boot-time.md) | A measurement note, not `versions/mvp/14`: each hop from Send to the agent's first byte, measured from the browser on one host, beside how Orca prepares a checkout before the click. It decides nothing; its questions are 02 open question 9 and 05 open question 8 |
| versions/mvp/ | [MVP design](versions/mvp/README.md) | In-depth design of the MVP, one document per area, with its own decision log |
| releases | [Releases and deployment artifacts](releases.md) | Independent web, API and runner versions; GitHub builds, deployment pulls by digest |
| next-steps/ | [Next steps](next-steps/README.md) | The versions after the MVP: 0.2 Git/GitHub, 0.3 Kanban, 0.4 Slack, 0.5 Mobile, 0.6 MCP/CLI/agent, 0.7 terminal and chat display, plus multi-account with no version yet |

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


- Web, API and runner ship independent semantic versions. GitHub validates each
  release commit and builds its artifacts; deployment consumes recorded image
  digests. Runner signing remains offline. Automated deployments follow later
  (`releases.md`, 2026-10-01).
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
